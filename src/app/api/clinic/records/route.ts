import { NextResponse } from "next/server";
import { readClinicSession } from "@/lib/auth";
import { deleteAirtableRecord, listAirtableRecords, saveAirtableRecord } from "@/lib/airtable";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = readClinicSession(request);
  if (!session) return NextResponse.json({ error: "Sign in to view clinic records." }, { status: 401 });
  try {
    const records = await listAirtableRecords();
    return NextResponse.json({ records: session.role === "doctor" ? records.filter((record: any) => String(record.fields?.Doctor || "").toLowerCase() === session.doctorName?.toLowerCase()) : records });
  }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load Airtable records." }, { status: 502 }); }
}

export async function POST(request: Request) { return writeRecord(request, null); }
export async function PATCH(request: Request) {
  const url = new URL(request.url);
  return writeRecord(request, url.searchParams.get("id"));
}
async function writeRecord(request: Request, id: string | null) {
  const session = readClinicSession(request);
  if (!session) return NextResponse.json({ error: "Sign in to update clinic records." }, { status: 401 });
  if (session.role !== "receptionist") return NextResponse.json({ error: "Only receptionists can update clinic records." }, { status: 403 });
  try {
    const body = await request.json();
    if (!body?.fields || typeof body.fields !== "object" || Array.isArray(body.fields)) return NextResponse.json({ error: "Record fields are required." }, { status: 400 });
    if (id !== null && !/^rec[a-zA-Z0-9]+$/.test(id)) return NextResponse.json({ error: "Invalid Airtable record ID." }, { status: 400 });
    const fields = { ...body.fields };
    if (Array.isArray(body.clearFields)) {
      for (const field of body.clearFields) {
        if (typeof field !== "string" || field.length > 100) return NextResponse.json({ error: "Invalid field name to clear." }, { status: 400 });
        fields[field] = null;
      }
    }
    return NextResponse.json(await saveAirtableRecord(id, fields));
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save Airtable record." }, { status: 502 }); }
}

export async function DELETE(request: Request) {
  const session = readClinicSession(request);
  if (!session) return NextResponse.json({ error: "Sign in to delete clinic records." }, { status: 401 });
  if (session.role !== "receptionist") return NextResponse.json({ error: "Only receptionists can delete clinic records." }, { status: 403 });
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!/^rec[a-zA-Z0-9]+$/.test(id)) return NextResponse.json({ error: "Invalid Airtable record ID." }, { status: 400 });
  try { await deleteAirtableRecord(id); return NextResponse.json({ ok: true }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not delete Airtable record." }, { status: 502 }); }
}
