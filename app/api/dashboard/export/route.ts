/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { PassThrough } from "stream";
import fs from "fs";
import path from "path";

/* ---------------------------------------------------------
   💵 FORMAT MONEY (USD)
--------------------------------------------------------- */
function formatUSD(value: any): string {
  const num = Number(value);
  if (isNaN(num)) return String(value);
  return num.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

/* Convert specific fields to USD formatting */
function convertMoneyFields(
  rows: Record<string, any>[],
  fields: string[]
): Record<string, any>[] {
  return rows.map((row) => {
    const updated = { ...row };
    fields.forEach((f) => {
      if (updated[f] !== undefined) {
        updated[f] = formatUSD(updated[f]);
      }
    });
    return updated;
  });
}

/* ---------------------------------------------------------
   📅 Format Income Trend: month + money
--------------------------------------------------------- */
function formatIncomeTrend(rows: any[]) {
  return rows.map((row) => {
    const updated = { ...row };

    if (updated.month) {
      const d = new Date(updated.month);
      updated.month = d.toLocaleString("en-US", {
        month: "short",
        year: "numeric",
      });
    }

    if (updated.monthly_income !== undefined) {
      updated.monthly_income = formatUSD(updated.monthly_income);
    }

    return updated;
  });
}

/* ---------------------------------------------------------
   🧹 Remove unwanted fields
--------------------------------------------------------- */
function hideFields<T extends Record<string, any>>(
  rows: T[],
  keys: string[]
): T[] {
  return rows.map((row) => {
    const clone = { ...row };
    keys.forEach((k) => delete clone[k]);
    return clone;
  });
}

/* ---------------------------------------------------------
   🧩 GENERIC TABLE DRAWER
--------------------------------------------------------- */
function drawTable(
  doc: PDFKit.PDFDocument,
  title: string,
  rows: Record<string, any>[],
  options: {
    marginLeft?: number;
    marginRight?: number;
    headerFontSize?: number;
    rowFontSize?: number;
    rowSpacing?: number;
    maxY?: number;
  } = {}
) {
  const {
    marginLeft = doc.page.margins.left,
    marginRight = doc.page.margins.right,
    headerFontSize = 8,
    rowFontSize = 9,
    rowSpacing = 6,
    maxY = doc.page.height - doc.page.margins.bottom - 40,
  } = options;

  doc.addPage();

  doc.font("Bold").fontSize(14).text(title, marginLeft);
  doc.moveDown(0.5);

  if (!rows || rows.length === 0) {
    doc.font("Regular").fontSize(11).text("No data available.", marginLeft);
    return;
  }

  const headers = Object.keys(rows[0]);
  const usableWidth = doc.page.width - marginLeft - marginRight;
  const colWidth = Math.floor(usableWidth / headers.length);
  const colWidths = headers.map(() => colWidth);

  const xPositions = headers.map((_, i) =>
    marginLeft + colWidths.slice(0, i).reduce((a, b) => a + b, 0)
  );

  const drawHeader = (yPos: number) => {
    doc.font("Bold").fontSize(headerFontSize);
    headers.forEach((h, i) => {
      doc.text(h.toUpperCase(), xPositions[i], yPos, {
        width: colWidths[i],
      });
    });

    const h = doc.heightOfString("M", { width: colWidths[0] });
    doc.moveTo(marginLeft, yPos + h + 2)
      .lineTo(marginLeft + usableWidth, yPos + h + 2)
      .stroke();

    return yPos + h + 6;
  };

  let y = drawHeader(doc.y);
  doc.font("Regular").fontSize(rowFontSize);

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];

    const texts = headers.map((h) => {
      const v = row[h];
      return v === undefined || v === null ? "-" : String(v);
    });

    const heights = texts.map((t, i) =>
      doc.heightOfString(t, { width: colWidths[i] })
    );
    const rowHeight = Math.max(...heights);

    if (y + rowHeight > maxY) {
      doc.addPage();
      y = drawHeader(doc.y);
      doc.font("Regular").fontSize(rowFontSize);
    }

    if (r % 2 === 0) {
      doc.save();
      doc.rect(marginLeft, y - 2, usableWidth, rowHeight + 4)
        .fillColor("#f7f7f7")
        .fill();
      doc.restore();
    }

    headers.forEach((h, i) => {
      doc.text(texts[i], xPositions[i], y, {
        width: colWidths[i],
      });
    });

    y += rowHeight + rowSpacing;
    doc.y = y;
  }

  doc.moveDown(1);
}

/* ---------------------------------------------------------
   🧾 MAIN EXPORT HANDLER
--------------------------------------------------------- */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      kpi,
      incomeTrend = [],
      leaseExp = [],
      propertiesByState = [],
      propertiesByCity = [],
      leaseStatus = [],
      documentStatus = [],
      documentsByType = [],
      startDate,
      endDate,
    } = body;

    let incomeByProperty = body.incomeByProperty ?? [];

    /* ---------------------------------------------------------
       💵 Money fields
    --------------------------------------------------------- */
    const MONEY_FIELDS = [
      "monthly_income",
      "annual_rent",
      "income",
      "rent",
      "total_income",
      "total_monthly_income",
    ];

    /* ---- Format KPI money ---- */
    const formattedKpi: any = { ...kpi };
    Object.keys(formattedKpi).forEach((key) => {
      if (MONEY_FIELDS.includes(key)) {
        formattedKpi[key] = formatUSD(formattedKpi[key]);
      }
    });

    /* ---- Format Income Trend (MONTH + USD) ---- */
    const formattedIncomeTrend = formatIncomeTrend(incomeTrend);

    /* ---- Income by Property: hide IDs + money ---- */
    incomeByProperty = hideFields(incomeByProperty, ["property_id"]);
    incomeByProperty = convertMoneyFields(incomeByProperty, MONEY_FIELDS);

    /* Load fonts */
    const fontRegular = fs.readFileSync(
      path.join(process.cwd(), "public/fonts/Roboto-Regular.ttf")
    );
    const fontBold = fs.readFileSync(
      path.join(process.cwd(), "public/fonts/Roboto-Bold.ttf")
    );

    /* Setup PDF */
    const stream = new PassThrough();
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 70, left: 50, right: 40, bottom: 50 },
      bufferPages: true,
    });

    doc.pipe(stream);

    const webStream = new ReadableStream({
      start(controller) {
        stream.on("data", (chunk) => controller.enqueue(chunk));
        stream.on("end", () => controller.close());
        stream.on("error", (err) => controller.error(err));
      },
    });

    doc.registerFont("Regular", fontRegular);
    doc.registerFont("Bold", fontBold);

    /* ---------------------------------------------------------
       📌 Cover Page
    --------------------------------------------------------- */
    doc.font("Bold").fontSize(22).text("Dashboard Summary Report", {
      align: "center",
    });

    doc.moveDown(1);
    doc.font("Regular").fontSize(11);
    doc.text(`Start Date: ${startDate}`);
    doc.text(`End Date: ${endDate}`);
    doc.text(`Generated: ${new Date().toLocaleString()}`);
    doc.moveDown(2);

    /* ---------------------------------------------------------
       🧾 Draw All Tables
    --------------------------------------------------------- */
    drawTable(doc, "KPI Overview", [formattedKpi]);
    drawTable(doc, "Income Trend", formattedIncomeTrend);
    drawTable(doc, "Lease Expiring", leaseExp);
    drawTable(doc, "Properties by State", propertiesByState);
    drawTable(doc, "Properties by City", propertiesByCity);
    drawTable(doc, "Lease Status", leaseStatus);
    drawTable(doc, "Income by Property", incomeByProperty);
    drawTable(doc, "Document Status", documentStatus);
    drawTable(doc, "Documents by Type", documentsByType);

    /* Finish PDF */
    doc.end();

    return new Response(webStream, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=dashboard-report.pdf",
      },
    });
  } catch (err: any) {
    console.error("❌ Dashboard PDF ERROR:", err);
    return NextResponse.json(
      { error: "Failed to generate PDF", detail: err.message },
      { status: 500 }
    );
  }
}
