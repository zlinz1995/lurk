/* Local FAQ assistant. No AI service, network requests, or transcript storage. */
function lurkAnswer(question, catalog = []) {
  const q = question.toLowerCase().replace(/[’']/g, '').trim();
  const match = pattern => pattern.test(q);
  if (match(/\b(return|refund|cancel|warranty|guarantee)\b/)) return {text:'Return, cancellation, and warranty terms have not been set for this concept. Ask the maker for written terms before approving a quote or paying. This demo cannot process refunds.', link:'commission'};
  if (match(/\b(ship|shipping|delivery|deliver|pickup|pick up|location|located|where are|international)\b/)) return {text:'Pickup, delivery area, shipping costs, and workshop location still need maker confirmation. Delivery is separate from the sample prices and estimates. Include your fulfillment needs in the commission notes.',link:'commission'};
  if (match(/\b(dishwasher|microwave|care|clean|wash|soak|oil|maintenance)\b/)) return {text:'For wooden pieces, general care is gentle hand washing and prompt drying; avoid soaking, dishwashers, and microwaves. Follow the maker’s instructions for the actual wood and finish, including any re-oiling. These sample pieces do not yet have product-specific care instructions.'};
  if (match(/\b(food|drink|drinking|hot|coffee|tea|safe|safety|weight|support|medical|load|mobility)\b/)) return {text:'Food and hot-drink suitability depend on the wood, construction, and finish and must be confirmed by the maker. Cane and walking-stick concepts have no verified load rating or support guarantee. Describe the intended use before commissioning; this assistant cannot assess fit or safety.',link:'commission'};
  if (match(/\b(photo|photos|picture|pictures|upload|inspiration|reference)\b/)) return {text:'The commission form accepts up to 3 JPG, PNG, or WebP reference photos, up to 5 MB each. The workshop receives them when you send the form. A request export includes filenames, not image files, so keep the originals. Collection photos are stock references, not photos of actual Lurk inventory.',link:'commission'};
  if (match(/\b(ai|bot|human|privacy|private|data|store|stored|save|saved|sent|send|real|demo)\b/)) return {text:'I’m a built-in FAQ guide, not a live AI model or a person. I use the prototype’s information and sample catalog. This chat stays in memory, disappears on reload, and is not sent or saved. Sending the form shares your brief and selected photos with support@lurk-app.com. External photo URLs in an edited catalog can still load from their image hosts.'};
  if (match(/\b(lead|long|time|weeks|deadline|ready|rush|when|duration)\b/)) return {text:'Build windows are illustrative, not promised dates. The form estimates time from project type and size, starting after design approval. The maker would confirm the workshop queue, materials, and your deadline before scheduling. Open the form for a project-specific preview.',link:'commission'};
  if (match(/\b(custom|commission|personalize|personalized|engrave|engraving|carve|carving|request|dimension|dimensions|size|sizing|handleless)\b/)) return {text:'Start with a bowl, cup, walking stick, cane, or another idea. Share dimensions in inches, preferred wood, style, budget, deadline, and optional photos. Add engraving, grip shape, capacity, or other details in the notes. The preview gives an illustrative range; a maker must review the design and send a formal quote.',link:'commission'};
  if (match(/\b(buy|purchase|pay|payment|checkout|order|reserve|reservation|deposit)\b/)) return {text:'Open a piece and choose “Request to purchase” or “Commission something similar.” That prepares a commission brief. Use secure checkout when offered, or send a purchase inquiry to support@lurk-app.com. Final price and terms need maker confirmation.',link:'collection'};
  if (match(/\b(wood|woods|material|materials|walnut|maple|oak|bamboo|finish)\b/)) return {text:'The commission form offers white oak, walnut, maple, or help choosing. Wood and finish are confirmed with the maker based on your intended use. Stock photos show the visual direction and may use a different material; the Morning Cup photo is a bamboo reference for a tall, handleless shape.',link:'commission'};
  const piece = catalog.find(p => q.includes(p.name.toLowerCase()) || ({bowl:/\bbowls?\b/,cup:/\b(cups?|mugs?|tumbler)\b/,stick:/\b(walking sticks?|sticks?)\b/,cane:/\bcanes?\b/}[p.category]?.test(q)));
  if (piece) return {text:piece.name+': '+new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(piece.price)+(piece.status==='made'?' starting price':' sample price')+'. '+({available:'Listed as available in the sample catalog',made:'Made to order in the sample catalog',sold:'A past project marked sold in the sample catalog'}[piece.status])+'. Dimensions: '+piece.dimensions+'. '+piece.wood+'. These are demo details, not confirmed inventory or a formal quote.',link:'collection'};
  if (match(/\b(price|prices|cost|costs|much|budget|quote|estimate|estimates|available|availability|stock|sell|collection|products|pieces|make)\b/)) return {text:'The sample collection includes '+catalog.map(p=>p.name+' ('+new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(p.price)+')').join(', ')+'. Prices and availability are examples. For a custom range, use “Preview my estimate” in the commission form. Tax, shipping, and specialized work are excluded.',link:'collection'};
  if (match(/^(hi|hello|hey|thanks|thank you)[!. ]*$/)) return {text:'Hello! I can help with sample pieces, prices, custom requests, build times, care, and how this prototype works. What would you like to know?'};
  return {text:'I don’t have a confirmed answer to that. I can explain the sample collection, commissions, estimates, care, and purchasing. For anything specific to your project, add the question to your commission notes for maker review. Use the form to send the workshop your question.',link:'commission'};
}

if (typeof document !== 'undefined') {
  const launcher = document.querySelector('#chat-launcher');
  const panel = document.querySelector('#lurk-chat');
  const input = document.querySelector('#chat-question');
  const log = document.querySelector('#chat-log');
  function bubble(text, who, link) {
    const row = document.createElement('div'); row.className = 'chat-message '+who;
    const label = document.createElement('strong'); label.textContent = who==='visitor'?'You':'Lurk guide';
    const body = document.createElement('p'); body.textContent = text;
    row.append(label,body);
    if (link) { const a=document.createElement('a');a.href='#'+link;a.textContent=link==='collection'?'Explore the collection ↗':'Open commission form ↗';a.onclick=()=>{closeChat();document.querySelector(link==='collection'?'#collection':'#commission').scrollIntoView({block:'start'});if(link==='commission')document.querySelector('#brief').elements.name.focus({preventScroll:true});};row.append(a); }
    log.append(row);while(log.children.length>40)log.firstElementChild.remove();log.scrollTop=log.scrollHeight;
  }
  function closeChat(){panel.hidden=true;launcher.setAttribute('aria-expanded','false');launcher.setAttribute('aria-label','Open Lurk chat assistant');launcher.focus({preventScroll:true});}
  launcher.onclick=()=>{if(!panel.hidden){closeChat();return;}panel.hidden=false;launcher.setAttribute('aria-expanded','true');launcher.setAttribute('aria-label','Close Lurk chat assistant');input.focus({preventScroll:true});};
  document.querySelector('#chat-close').onclick=closeChat;
  panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();closeChat();}});
  function ask(question){if(!question.trim())return;bubble(question.trim(),'visitor');const reply=lurkAnswer(question,products);bubble(reply.text,'guide',reply.link);input.value='';}
  document.querySelector('#chat-form').onsubmit=e=>{e.preventDefault();ask(input.value);input.focus({preventScroll:true});};
  document.querySelectorAll('[data-chat-question]').forEach(b=>b.onclick=()=>ask(b.dataset.chatQuestion));
  document.querySelector('#chat-clear').onclick=()=>{log.replaceChildren();bubble('Ask me about pieces, custom requests, prices, build times, or care. I’m a local FAQ guide; nothing you type is sent or saved.','guide');};
  bubble('Hi, I’m your Lurk guide. Ask about pieces, custom requests, prices, build times, or care. I use built-in answers, not live AI. Nothing you type is sent or saved.','guide');
}
if (typeof module !== 'undefined') module.exports={lurkAnswer};
