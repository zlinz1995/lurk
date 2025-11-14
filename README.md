Anonymous, Ephemeral Image Board with Real-Time Chat
Lurk is a full-stack web and Android application designed for spontaneous, real-time communication. Start conversations effortlessly, upload images, and chat instantly — everything disappears automatically after one hour.
✨ Features
🕐 Ephemeral Threads – Posts and chats vanish automatically after 60 minutes


💬 Real-Time Chat – Web based messaging with instant updates


🖼️ Image Uploads – Share and view images inside threads


🕵️ Anonymous Mode – No account required.  User account creation coming.


📱 Android Support – Built using Bubblewrap 


🧱 Tech Stack
Frontend: HTML, CSS, JavaScript (Vanilla)
Backend: Node.js, Express
 Database: SQLite
 WebSocket / Real-Time: Socket.io
 Android App: Bubblewrap + Gradle
 Hosting: Render



🚀 Getting Started
Clone the repository using git clone
Install needed dependencies 
Start server.

📲 Android Build
This project includes a fully functional Android app built from the same web codebase using Bubblewrap 
Files included:
app-release-signed.apk – ready for sideload testing
app-release-bundle.aab – upload-ready for Google Play
build.gradle / AndroidManifest.xml – Android project config
⚠️ Note: The Android app loads the same domain as the web app, meaning updates to your hosted site appear automatically in the mobile app.
📦 Deployment
Lurk is hosted using Render and automatically redeploys when changes are pushed to this GitHub repository.
🧠 Developer Notes
Use .gitignore to keep private files secure


📜 License
MIT License © 2025 Zachary Linz
