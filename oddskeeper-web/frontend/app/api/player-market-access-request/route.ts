import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const brevoKey = process.env.BREVO_API_KEY;

    if (!brevoKey) {
      console.log(`[Player Market Access Request] Email: ${email} (Brevo key not set)`);
      return NextResponse.json({ ok: true });
    }

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": brevoKey,
      },
      body: JSON.stringify({
        sender: { name: "OddsKeeper", email: "noreply@pixellious.com" },
        to: [{ email: "no-reply@pixellious.com", name: "Pixellious Support" }],
        subject: "Player Market Access Request",
        htmlContent: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
            <h2 style="color:#1a1a2e;margin-bottom:8px;">Player Market Access Request</h2>
            <p style="color:#444;margin-bottom:16px;">
              A user has requested access to the <strong>Player Market Prediction</strong> page.
            </p>
            <table style="background:#f5f5f5;border-radius:8px;padding:16px;width:100%;">
              <tr>
                <td style="color:#666;font-size:13px;">Requested by</td>
              </tr>
              <tr>
                <td style="color:#1a1a2e;font-size:16px;font-weight:600;padding-top:4px;">${email}</td>
              </tr>
            </table>
            <p style="color:#888;font-size:12px;margin-top:24px;">
              To grant access, add this email to the whitelist in <code>access.ts</code>.
            </p>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Brevo error:", err);
      return NextResponse.json({ error: "Mail send failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Access request error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}