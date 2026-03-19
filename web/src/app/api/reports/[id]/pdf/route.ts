import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: true,
  });
  
  try {
    const page = await browser.newPage();
    // Navigate to the report page
    const reportUrl = `${process.env.NEXT_PUBLIC_URL}/reports/${id}`;
    
    await page.goto(reportUrl, {
      waitUntil: "networkidle0",
    });

    // Wait for any charts or animations to finish
    await new Promise((r) => setTimeout(r, 2000));

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "10mm", bottom: "10mm" },
    });

    await browser.close();

    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="aedra-report-${id}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error("PDF Generation Error:", error);
    if (browser) await browser.close();
    return new NextResponse(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}
