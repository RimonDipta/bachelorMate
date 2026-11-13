import { Link } from "react-router-dom";
import Nav from "./landing/Nav";
import { Footer } from "./landing/Showcases";
import "../styles/landing.css";

// Plain-language summaries of how this codebase handles data. Review with a
// legal professional before relying on them for a commercial launch.
function Privacy() {
  return (
    <>
      <h1>Privacy</h1>
      <p className="muted-note">Plain-language summary of how BachelorMate handles your data.</p>
      <h2>What we store</h2>
      <ul>
        <li>Your account: name, email, an optional phone number, bio and profile picture. Passwords are stored only as salted hashes.</li>
        <li>Home data you or your housemates enter: meals, requests, expenses, payments, receipts, announcements, grocery items and calendar events.</li>
        <li>Messages in home chats and friend chats, including previous versions of edited or deleted messages, kept for accountability.</li>
        <li>Notifications and your preferences (theme, notification settings).</li>
      </ul>
      <h2>Who can see it</h2>
      <ul>
        <li>Home data is visible only to active members of that home, limited further by their role.</li>
        <li>When you leave or are removed from a home, you lose access immediately; the home keeps its financial history.</li>
        <li>Friend search shows only your name, picture and bio — never your email — and you can turn discovery off.</li>
      </ul>
      <h2>Emails and cookies</h2>
      <p>We send emails for account security (verification, password reset) and for important home events, which you can turn off in settings. We use one essential, http-only cookie to keep you signed in, and local storage for your theme. No advertising or third-party tracking cookies.</p>
      <h2>Deleting data</h2>
      <p>Home admins can permanently delete a home and all of its records. To delete your account, contact the operator of this BachelorMate installation.</p>
    </>
  );
}

function Terms() {
  return (
    <>
      <h1>Terms</h1>
      <p className="muted-note">The simple rules for using BachelorMate.</p>
      <h2>Using the service</h2>
      <ul>
        <li>Keep your account secure and don't share your password.</li>
        <li>Only invite people who live in, or are joining, your home.</li>
        <li>Don't use chat or any other feature to harass others or share unlawful content.</li>
      </ul>
      <h2>Money records</h2>
      <p>BachelorMate is a record-keeping tool. It doesn't hold or transfer money; amounts are what your home's members record. Settle disagreements within your home — every change is kept in the activity log to help.</p>
      <h2>Availability</h2>
      <p>The service is provided as is. We work to keep it reliable and your data safe, but we can't guarantee uninterrupted availability.</p>
    </>
  );
}

export default function Legal({ page }) {
  return (
    <div className="lp">
      <Nav />
      <main className="lp-legal">
        {page === "terms" ? <Terms /> : <Privacy />}
        <p style={{ marginTop: 40 }}><Link to="/" style={{ color: "var(--lp-brand-ink)", fontWeight: 600 }}>← Back to home</Link></p>
      </main>
      <Footer />
    </div>
  );
}
