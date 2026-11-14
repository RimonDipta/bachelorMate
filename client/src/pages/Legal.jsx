import { Link } from "react-router-dom";
import Nav from "./landing/Nav";
import { Footer } from "./landing/Showcases";
import { useI18n } from "../i18n/I18nProvider";
import "../styles/landing.css";

// Plain-language summaries of how this codebase handles data. Review with a
// legal professional before relying on them for a commercial launch.
// Long-form copy is kept here per language rather than in the string files.
const PRIVACY = {
  en: {
    title: "Privacy",
    note: "Plain-language summary of how BachelorMate handles your data.",
    sections: [
      ["What we store", [
        "Your account: name, email, an optional phone number, bio and profile picture. Passwords are stored only as salted hashes.",
        "Home data you or your housemates enter: meals, requests, expenses, payments, receipts, announcements, grocery items and calendar events.",
        "Messages in home chats and friend chats, including previous versions of edited or deleted messages, kept for accountability.",
        "Notifications and your preferences (theme, language, notification settings).",
      ]],
      ["Who can see it", [
        "Home data is visible only to active members of that home, limited further by their role.",
        "When you leave or are removed from a home, you lose access immediately; the home keeps its financial history.",
        "Friend search shows only your name, picture and bio — never your email — and you can turn discovery off.",
      ]],
      ["Emails and cookies", "We send emails for account security (verification, password reset) and for important home events, which you can turn off in settings. We use one essential, http-only cookie to keep you signed in, and local storage for your theme and language. No advertising or third-party tracking cookies."],
      ["Deleting data", "Home admins can permanently delete a home and all of its records. You can download your data or delete your account yourself from Account settings → Your data."],
    ],
  },
  bn: {
    title: "গোপনীয়তা",
    note: "BachelorMate আপনার তথ্য কীভাবে রাখে, সহজ ভাষায়।",
    sections: [
      ["আমরা যা রাখি", [
        "আপনার অ্যাকাউন্ট: নাম, ইমেইল, ঐচ্ছিক ফোন নম্বর, নিজের সম্পর্কে আর প্রোফাইল ছবি। পাসওয়ার্ড শুধু সল্ট দেওয়া হ্যাশ হিসেবে রাখা হয়।",
        "আপনি বা আপনার রুমমেটরা বাসার যে তথ্য দেন: মিল, রিকোয়েস্ট, খরচ, জমা, রসিদ, নোটিশ, বাজারের লিস্ট আর ক্যালেন্ডারের ইভেন্ট।",
        "বাসার চ্যাট আর বন্ধুদের চ্যাটের মেসেজ, এডিট বা মোছা মেসেজের আগের রূপসহ — জবাবদিহির জন্য।",
        "নোটিফিকেশন আর আপনার পছন্দ (থিম, ভাষা, নোটিফিকেশন সেটিংস)।",
      ]],
      ["কারা দেখতে পায়", [
        "বাসার তথ্য শুধু সেই বাসার বর্তমান সদস্যরা দেখতে পান, তাও দায়িত্ব অনুযায়ী সীমিত।",
        "বাসা ছাড়লে বা বাদ পড়লে সাথে সাথে প্রবেশ বন্ধ হয়; বাসার টাকার হিসাব থেকে যায়।",
        "বন্ধু খোঁজায় শুধু আপনার নাম, ছবি আর নিজের সম্পর্কে দেখায় — ইমেইল কখনো না — আর চাইলে খুঁজে পাওয়া বন্ধ করতে পারেন।",
      ]],
      ["ইমেইল আর কুকি", "অ্যাকাউন্টের নিরাপত্তার জন্য (যাচাই, পাসওয়ার্ড রিসেট) আর বাসার জরুরি খবরের জন্য ইমেইল পাঠাই, যা সেটিংস থেকে বন্ধ করা যায়। সাইন ইন রাখতে একটি জরুরি http-only কুকি আর থিম ও ভাষার জন্য লোকাল স্টোরেজ ব্যবহার করি। কোনো বিজ্ঞাপন বা বাইরের ট্র্যাকিং কুকি নেই।"],
      ["তথ্য মোছা", "বাসার অ্যাডমিন বাসা আর এর সব রেকর্ড চিরতরে মুছে ফেলতে পারেন। অ্যাকাউন্ট সেটিংস → আপনার ডেটা থেকে নিজেই তথ্য ডাউনলোড বা অ্যাকাউন্ট মুছে ফেলতে পারেন।"],
    ],
  },
};

const TERMS = {
  en: {
    title: "Terms",
    note: "The simple rules for using BachelorMate.",
    sections: [
      ["Using the service", [
        "Keep your account secure and don't share your password.",
        "Only invite people who live in, or are joining, your home.",
        "Don't use chat or any other feature to harass others or share unlawful content.",
      ]],
      ["Money records", "BachelorMate is a record-keeping tool. It doesn't hold or transfer money; amounts are what your home's members record. Settle disagreements within your home — every change is kept in the activity log to help."],
      ["Availability", "The service is provided as is. We work to keep it reliable and your data safe, but we can't guarantee uninterrupted availability."],
    ],
  },
  bn: {
    title: "শর্তাবলি",
    note: "BachelorMate ব্যবহারের সহজ নিয়ম।",
    sections: [
      ["সেবা ব্যবহার", [
        "অ্যাকাউন্ট নিরাপদ রাখুন, পাসওয়ার্ড কাউকে দেবেন না।",
        "শুধু যারা আপনার বাসায় থাকে বা আসছে তাদেরই আমন্ত্রণ জানান।",
        "চ্যাট বা অন্য কোনো ফিচার দিয়ে কাউকে হয়রানি করবেন না বা বেআইনি কিছু শেয়ার করবেন না।",
      ]],
      ["টাকার হিসাব", "BachelorMate শুধু হিসাব রাখার টুল। এটা টাকা রাখে না বা পাঠায় না; বাসার সদস্যরা যা লেখেন সেটাই হিসাব। মতের অমিল বাসার ভেতরেই মেটান — সাহায্যের জন্য প্রতিটি পরিবর্তন কার্যকলাপে থেকে যায়।"],
      ["সেবার প্রাপ্যতা", "সেবাটি যেমন আছে তেমন দেওয়া হয়। এটাকে নির্ভরযোগ্য আর আপনার তথ্য নিরাপদ রাখতে কাজ করি, তবে সবসময় চালু থাকার নিশ্চয়তা দিতে পারি না।"],
    ],
  },
};

function Doc({ doc }) {
  return (
    <>
      <h1>{doc.title}</h1>
      <p className="muted-note">{doc.note}</p>
      {doc.sections.map(([heading, body]) => (
        <section key={heading}>
          <h2>{heading}</h2>
          {Array.isArray(body) ? <ul>{body.map((li) => <li key={li}>{li}</li>)}</ul> : <p>{body}</p>}
        </section>
      ))}
    </>
  );
}

export default function Legal({ page }) {
  const { lang, t } = useI18n();
  const doc = (page === "terms" ? TERMS : PRIVACY)[lang] || (page === "terms" ? TERMS : PRIVACY).en;
  return (
    <div className="lp">
      <Nav />
      <main className="lp-legal">
        <Doc doc={doc} />
        <p style={{ marginTop: 40 }}><Link to="/" style={{ color: "var(--lp-brand-ink)", fontWeight: 600 }}>← {t("legal.back")}</Link></p>
      </main>
      <Footer />
    </div>
  );
}
