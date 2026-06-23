export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 720, margin: '60px auto', padding: '0 24px', fontFamily: "'DM Sans', sans-serif", color: '#1a1208', lineHeight: 1.7 }}>
      <h1 style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ color: '#7a6a50', fontSize: 13, marginBottom: 40 }}>Oh Hey There Matcha Cafe — OHT Notifications App<br />Last updated: June 2026</p>

      <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 32 }}>1. What This App Does</h2>
      <p style={{ fontSize: 14 }}>The OHT Notifications app is an internal tool used exclusively by Oh Hey There Matcha Cafe staff. It sends operational notifications (shift schedules, job orders, payslips, and similar updates) directly to staff members via Facebook Messenger.</p>

      <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 32 }}>2. Information We Collect</h2>
      <p style={{ fontSize: 14 }}>When a staff member links their Messenger account, we store their Facebook Page-Scoped ID (PSID) in our internal database. We do not collect any other personal information through this app beyond what is already held in our internal HR system.</p>

      <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 32 }}>3. How We Use Your Information</h2>
      <p style={{ fontSize: 14 }}>Your PSID is used solely to deliver work-related notifications to you via Messenger. We do not use it for marketing, advertising, or any purpose outside of internal cafe operations.</p>

      <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 32 }}>4. Data Sharing</h2>
      <p style={{ fontSize: 14 }}>We do not share your information with any third parties. Your data is stored securely in our internal systems and is accessible only to authorized Oh Hey There Matcha Cafe administrators.</p>

      <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 32 }}>5. Data Retention</h2>
      <p style={{ fontSize: 14 }}>Your Messenger link data is retained for as long as you are an active staff member. You may request to unlink your Messenger account at any time by contacting your administrator.</p>

      <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 32 }}>6. Contact</h2>
      <p style={{ fontSize: 14 }}>For any questions about this privacy policy, contact us at <a href="mailto:ohheythere.matcha@gmail.com" style={{ color: '#EF4576' }}>ohheythere.matcha@gmail.com</a>.</p>

      <p style={{ fontSize: 12, color: '#7a6a50', marginTop: 60, borderTop: '1px solid #e8e0d5', paddingTop: 20 }}>© 2026 Oh Hey There Matcha Cafe. All rights reserved.</p>
    </div>
  )
}
