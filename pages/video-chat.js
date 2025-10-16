import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Layout from '../components/Layout';

const ioPromise = import('socket.io-client');
const VideoPlayer = dynamic(() => Promise.resolve(VideoPlayerInner), { ssr: false });

const ROOM_ID = 'global-video-room';
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' }
];
const MAX_MESSAGES = 200;

export default function VideoChatPage() {
  const [connectionStatus, setConnectionStatus] = useState('Initializing...');
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [nameDraft, setNameDraft] = useState('');
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [peerLabels, setPeerLabels] = useState({});
  const localVideoRef = useRef(null);
  const peersRef = useRef(new Map());
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const pendingCandidates = useRef(new Map());
  const messageContainerRef = useRef(null);

  useEffect(() => {
    const storedName = typeof window !== 'undefined' ? window.localStorage.getItem('lurk:videoChatName') : '';
    if (storedName) {
      setDisplayName(storedName);
      setNameDraft(storedName);
    } else {
      const random = 'Guest-' + Math.random().toString(36).slice(2, 7);
      setDisplayName(random);
      setNameDraft(random);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('lurk:videoChatName', random);
      }
    }
  }, []);

  useEffect(() => {
    if (!displayName) return undefined;

    let isMounted = true;
    let cleanupResolved = false;
    const cleanup = async () => {
      if (cleanupResolved) return;
      cleanupResolved = true;
      try {
        socketRef.current?.emit('leave-video-room', { roomId: ROOM_ID });
      } catch {}
      try {
        socketRef.current?.disconnect();
      } catch {}
      peersRef.current.forEach((pc) => {
        try { pc.close(); } catch {}
      });
      peersRef.current.clear();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      pendingCandidates.current.clear();
    };

    const init = async () => {
      try {
        setConnectionStatus('Requesting media devices...');
        const mediaDevices = navigator?.mediaDevices;
        if (!mediaDevices?.getUserMedia) {
          setConnectionStatus('Camera or microphone not supported in this browser.');
          return;
        }
        const stream = await mediaDevices.getUserMedia({ video: true, audio: true });
        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        setConnectionStatus('Connecting to video room...');

        const { io } = await ioPromise;
        if (!isMounted) return;
        const socket = io();
        socketRef.current = socket;
        registerSocketHandlers(socket);
        socket.emit('join-video-room', { roomId: ROOM_ID, name: displayName });
      } catch (err) {
        console.error('[VideoChat] failed to init', err);
        setConnectionStatus('Media access denied or unavailable.');
      }
    };

    const registerSocketHandlers = (socket) => {
      socket.on('connect', () => {
        setConnectionStatus('Connected. Waiting for peers...');
      });

      socket.on('disconnect', () => {
        setConnectionStatus('Disconnected from server.');
        peersRef.current.forEach((pc) => {
          try { pc.close(); } catch {}
        });
        peersRef.current.clear();
        setRemoteStreams([]);
      });

      socket.on('video-existing-peers', (peers = []) => {
        if (!Array.isArray(peers)) return;
        const labels = {};
        peers.forEach((entry) => {
          const peerId = typeof entry === 'string' ? entry : entry?.peerId;
          if (!peerId) return;
          const label = typeof entry === 'object' ? entry?.name : undefined;
          if (label) labels[peerId] = label;
          ensurePeerConnection(peerId, true);
        });
        if (Object.keys(labels).length) {
          setPeerLabels((prev) => ({ ...prev, ...labels }));
        }
      });

      socket.on('video-peer-joined', ({ peerId, name }) => {
        addSystemMessage(`${name || 'A participant'} joined the room.`);
        if (peerId && name) {
          setPeerLabels((prev) => {
            if (prev[peerId] === name) return prev;
            return { ...prev, [peerId]: name };
          });
        }
        ensurePeerConnection(peerId, true);
      });

      socket.on('video-offer', async ({ from, description }) => {
        const pc = ensurePeerConnection(from, false);
        try {
          await pc.setRemoteDescription(description);
          flushPendingCandidates(from, pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('video-answer', { roomId: ROOM_ID, to: from, description: pc.localDescription });
        } catch (err) {
          console.error('[VideoChat] handle offer error', err);
        }
      });

      socket.on('video-answer', async ({ from, description }) => {
        const pc = peersRef.current.get(from);
        if (!pc) return;
        try {
          await pc.setRemoteDescription(description);
          flushPendingCandidates(from, pc);
        } catch (err) {
          console.error('[VideoChat] handle answer error', err);
        }
      });

      socket.on('video-ice-candidate', async ({ from, candidate }) => {
        let pc = peersRef.current.get(from);
        if (!pc) {
          pendingCandidates.current.set(from, [
            ...(pendingCandidates.current.get(from) || []),
            candidate
          ]);
          pc = ensurePeerConnection(from, false);
          return;
        }
        try {
          await pc.addIceCandidate(candidate);
        } catch (err) {
          console.error('[VideoChat] ICE add error', err);
        }
      });

      socket.on('video-peer-left', ({ peerId, name }) => {
        teardownPeer(peerId);
        addSystemMessage(`${name || 'A participant'} left the room.`);
      });

      socket.on('video-room-message', (payload) => {
        if (!payload) return;
        setMessages((prev) => {
          if (prev.some((item) => item.id === payload.id)) return prev;
          const next = [...prev, payload];
          return next.slice(-MAX_MESSAGES);
        });
        autoScrollMessages();
      });
    };

    const ensurePeerConnection = (peerId, initiator) => {
      if (peersRef.current.has(peerId)) return peersRef.current.get(peerId);
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peersRef.current.set(peerId, pc);
      const stream = localStreamRef.current;
      if (stream) {
        stream.getTracks().forEach((track) => {
          try { pc.addTrack(track, stream); } catch (err) { console.error('[VideoChat] addTrack error', err); }
        });
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socketRef.current?.emit('video-ice-candidate', {
            roomId: ROOM_ID,
            to: peerId,
            candidate: event.candidate
          });
        }
      };

      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        if (!remoteStream) return;
        setRemoteStreams((prev) => {
          const exists = prev.some((item) => item.peerId === peerId);
          if (exists) return prev.map((item) => item.peerId === peerId ? { peerId, stream: remoteStream } : item);
          return [...prev, { peerId, stream: remoteStream }];
        });
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === 'connected') {
          setConnectionStatus('Connected to peers.');
        } else if (state === 'failed') {
          teardownPeer(peerId);
        }
      };

      if (initiator) {
        (async () => {
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socketRef.current?.emit('video-offer', {
              roomId: ROOM_ID,
              to: peerId,
              description: pc.localDescription
            });
          } catch (err) {
            console.error('[VideoChat] create offer error', err);
          }
        })();
      }

      return pc;
    };

    const flushPendingCandidates = async (peerId, pc) => {
      const queue = pendingCandidates.current.get(peerId);
      if (!queue?.length) return;
      for (const candidate of queue) {
        try { await pc.addIceCandidate(candidate); } catch (err) { console.error('[VideoChat] flush ICE error', err); }
      }
      pendingCandidates.current.delete(peerId);
    };

    const teardownPeer = (peerId) => {
      const pc = peersRef.current.get(peerId);
      if (pc) {
        try { pc.close(); } catch {}
        peersRef.current.delete(peerId);
      }
      setRemoteStreams((prev) => prev.filter((item) => item.peerId !== peerId));
      pendingCandidates.current.delete(peerId);
      if (peerId) {
        setPeerLabels((prev) => {
          if (!Object.prototype.hasOwnProperty.call(prev, peerId)) return prev;
          const next = { ...prev };
          delete next[peerId];
          return next;
        });
      }
    };

    const addSystemMessage = (text) => {
      setMessages((prev) => {
        const next = [...prev, { id: `sys-${Date.now()}`, system: true, text, ts: Date.now() }];
        return next.slice(-MAX_MESSAGES);
      });
      autoScrollMessages();
    };

    const autoScrollMessages = () => {
      const el = messageContainerRef.current;
      if (!el) return;
      requestAnimationFrame(() => {
        try { el.scrollTop = el.scrollHeight; } catch {}
      });
    };

    init();

    return () => {
      isMounted = false;
      cleanup();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayName]);

  const handleSendChat = (event) => {
    event.preventDefault();
    const text = chatInput.trim();
    if (!text || !socketRef.current) return;
    const payload = {
      id: `${socketRef.current.id}-${Date.now()}`,
      name: displayName,
      text,
      ts: Date.now()
    };
    socketRef.current.emit('video-room-message', { roomId: ROOM_ID, ...payload });
    setMessages((prev) => {
      const next = [...prev, { ...payload, self: true }];
      return next.slice(-MAX_MESSAGES);
    });
    setChatInput('');
    const el = messageContainerRef.current;
    if (el) {
      requestAnimationFrame(() => { try { el.scrollTop = el.scrollHeight; } catch {} });
    }
  };

  const handleNameSave = (event) => {
    event.preventDefault();
    const trimmed = nameDraft.trim();
    if (!trimmed) return;
    setDisplayName(trimmed);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('lurk:videoChatName', trimmed);
    }
  };

  const formattedMessages = useMemo(() => messages.map((msg) => ({
    ...msg,
    time: new Date(msg.ts || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  })), [messages]);

  return (
    <Layout title="Live Video Room" subtitle="Chat face-to-face while staying in sync">
      <section className="video-chat-page">
        <div className="video-chat-card">
          <header className="video-chat-card__header">
            <div>
              <h2>Video Chat</h2>
              <p className="muted">{connectionStatus}</p>
            </div>
            <form className="video-chat-name" onSubmit={handleNameSave}>
              <label htmlFor="video-chat-name-input">Name</label>
              <input
                id="video-chat-name-input"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                placeholder="Display name"
              />
              <button type="submit">Save</button>
            </form>
          </header>
          <div className="video-grid">
            <div className="video-tile self">
              <video ref={localVideoRef} autoPlay playsInline muted />
              <span className="video-label">You ({displayName})</span>
            </div>
            {remoteStreams.map(({ peerId, stream }) => (
              <div className="video-tile" key={peerId}>
                <VideoPlayer stream={stream} />
                <span className="video-label">{peerLabels[peerId] || `Peer ${peerId.slice(-4)}`}</span>
              </div>
            ))}
            {!remoteStreams.length && (
              <div className="video-placeholder">
                <p>No peers connected yet. Share this page to start a call.</p>
              </div>
            )}
          </div>
          <section className="video-chat-messages">
            <div className="video-chat-messages__list" ref={messageContainerRef}>
              {formattedMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`video-chat-message${msg.self ? ' self' : ''}${msg.system ? ' system' : ''}`}
                  aria-live="polite"
                >
                  {!msg.system && (
                    <header>
                      <strong>{msg.name || 'Anon'}</strong>
                      <time dateTime={new Date(msg.ts || Date.now()).toISOString()}>{msg.time}</time>
                    </header>
                  )}
                  <p>{msg.text}</p>
                </div>
              ))}
            </div>
            <form className="video-chat-form" onSubmit={handleSendChat}>
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type a message..."
                maxLength={500}
                aria-label="Send a chat message"
              />
              <button type="submit" disabled={!chatInput.trim()}>Send</button>
            </form>
          </section>
        </div>
      </section>
    </Layout>
  );
}

function VideoPlayerInner({ stream }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = stream;
    }
  }, [stream]);

  return <video ref={ref} autoPlay playsInline />;
}
