import { Suspense } from "react";
import ProfileClient from "./profile-client";

function ProfileFallback() {
  return (
    <main className="profile-page">
      <section className="glass-card profile-section">
        <div className="profile-empty">Loading profile...</div>
      </section>
    </main>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfileFallback />}>
      <ProfileClient />
    </Suspense>
  );
}
