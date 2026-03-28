import { NextResponse } from "next/server";

const RAILWAY_URL =
  "https://dash-pane-production.up.railway.app/api/admin/dashboard?secret=428627173b08e292a8cb0665d0ab1d802f69bfbeb8e42794d35546bca499955a";

export async function GET() {
  try {
    const [dashRes, fxRes] = await Promise.all([
      fetch(RAILWAY_URL, { next: { revalidate: 60 } }),
      fetch("https://open.er-api.com/v6/latest/USD", { next: { revalidate: 3600 } }),
    ]);

    if (!dashRes.ok) {
      return NextResponse.json({ error: "Railway fetch failed" }, { status: 502 });
    }

    const data = await dashRes.json();
    const licenses: Array<{ amount: number; currency: string }> = data.licenses ?? [];

    // Live INR/USD rate (fallback to 83 if FX fetch fails)
    let inrRate = 83;
    if (fxRes.ok) {
      const fx = await fxRes.json();
      if (fx?.rates?.INR) inrRate = fx.rates.INR;
    }

    let revenueUSD = 0;
    for (const lic of licenses) {
      const amountMajor = lic.amount / 100; // paise/cents to major unit
      if (lic.currency === "USD") {
        revenueUSD += amountMajor;
      } else if (lic.currency === "INR") {
        revenueUSD += amountMajor / inrRate;
      }
    }

    return NextResponse.json({
      revenue: Math.round(revenueUSD * 100) / 100,
      sales: data.total_licenses ?? 0,
      activated: data.total_activations ?? 0,
      inrRate,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
