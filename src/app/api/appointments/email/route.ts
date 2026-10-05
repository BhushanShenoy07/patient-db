import { NextResponse } from "next/server";
import { listClinicDoctors, loadClinicAccounts, readClinicSession } from "@/lib/auth";
import { createAppointmentActionToken, createFollowupTicket, escapeHtml } from "@/lib/followups";
import { airtableRequest, COL, saveAirtableRecord } from "@/lib/airtable";

export const runtime = "nodejs";

const normalizeDoc = (name?: string) =>
  (name || "")
    .trim()
    .toLowerCase()
    .replace(/^dr\.?\s*/, "")
    .replace(/[^a-z0-9]/g, "");

function formatDisplayDate(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return dateStr;
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export async function POST(request: Request) {
  const session = readClinicSession(request);
  if (!session) {
    return NextResponse.json({ error: "Sign in before sending appointment notifications." }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const appointmentId = typeof body.appointmentId === "string" ? body.appointmentId.trim() : "";

    // 1. Fetch fresh record details from Airtable
    let airtableFields: Record<string, any> = {};
    if (appointmentId && appointmentId.startsWith("rec")) {
      try {
        const airtableRecord = await airtableRequest(`/${appointmentId}`);
        if (airtableRecord?.fields) {
          airtableFields = airtableRecord.fields;
        }
      } catch (err) {
        console.warn("Could not query Airtable directly for email details; falling back to request payload:", err);
      }
    }

    // 2. Extract and merge fields with Airtable taking precedence
    const name = String(airtableFields[COL.name] || body.name || "").trim();
    const email = String(airtableFields[COL.email] || body.email || "").trim().toLowerCase();
    const phone = String(airtableFields[COL.phone] || body.phone || "").trim();
    const doctor = String(airtableFields[COL.doctor] || body.doctor || "").trim();
    const date = String(airtableFields[COL.date] || body.date || "").trim();
    const time = String(airtableFields[COL.time] || body.time || "").trim();
    const rawMode = String(airtableFields[COL.mode] || body.mode || "Online").trim();
    const mode = rawMode.toLowerCase() === "online" ? "Online" : "Offline";
    const status = String(airtableFields[COL.status] || body.status || "Scheduled").trim();
    const zoomId = String(airtableFields[COL.zoomId] || body.zoomId || "").trim();
    const zoomUrl = String(airtableFields[COL.zoomUrl] || body.zoomUrl || "").trim();
    const notes = String(airtableFields[COL.notes] || body.notes || "").trim();
    const bloodGroup = String(airtableFields[COL.bloodGroup] || body.bloodGroup || "").trim();

    // 3. Resolve Doctor account & email
    const clinicDoctors = listClinicDoctors();
    const allAccounts = loadClinicAccounts();
    const doctorAccount =
      clinicDoctors.find(d => normalizeDoc(d.name) === normalizeDoc(doctor)) ||
      allAccounts.find(a => normalizeDoc(a.doctorName || a.name) === normalizeDoc(doctor));

    const doctorEmail = (doctorAccount?.email || `${normalizeDoc(doctor)}@clinic.com`).trim().toLowerCase();

    // 4. Validate essential fields
    if (!appointmentId || !name || !/^\S+@\S+\.\S+$/.test(email) || !doctor || !date || !time) {
      return NextResponse.json(
        { error: "Appointment requires a patient name, valid email address, assigned physician, date, and time." },
        { status: 400 }
      );
    }

    if (session.role === "doctor" && session.doctorName && normalizeDoc(doctor) !== normalizeDoc(session.doctorName)) {
      return NextResponse.json({ error: "Physicians can only dispatch notifications for their own consultations." }, { status: 403 });
    }

    // 5. Generate secure patient action token
    const isCancelled = status.toLowerCase() === "cancelled";
    const token = !isCancelled
      ? createAppointmentActionToken({
          appointmentId,
          name,
          email,
          doctor,
          doctorEmail,
          date,
          time,
          mode,
          zoomId,
          zoomUrl,
        })
      : "";

    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const actionUrl = (action: string) => {
      const url = new URL("/appointment-response", origin);
      url.searchParams.set("token", token);
      url.searchParams.set("action", action);
      return url.toString();
    };

    const safeName = escapeHtml(name);
    const safeDoctor = escapeHtml(doctor);
    const safeDate = escapeHtml(formatDisplayDate(date));
    const safeTime = escapeHtml(time);
    const isOnline = mode === "Online";
    const clinicAddress = process.env.CLINIC_ADDRESS || "Clinic Desk Healthcare Centre, Bejai, Mangaluru, Karnataka, India";

    // 6. Frame Kindful, Healthcare-Grade HTML Email Body
    let emailHtml = "";
    let emailSubject = "";

    if (isCancelled) {
      emailSubject = `Clinic Desk · Appointment Cancellation Notice · ${name} with ${doctor} · ${date}`;
      emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; color: #1e293b; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <div style="background: linear-gradient(135deg, #475569 0%, #334155 100%); padding: 24px; color: #ffffff; text-align: center;">
            <h1 style="margin: 0 0 6px 0; font-size: 22px; font-weight: 700;">Clinic Desk Healthcare</h1>
            <p style="margin: 0; font-size: 14px; opacity: 0.9;">Appointment Cancellation Notice</p>
          </div>
          <div style="padding: 24px;">
            <p style="font-size: 16px; margin: 0 0 16px 0;">Dear <strong>${safeName}</strong>,</p>
            <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 20px 0;">
              This is a gentle notification that your scheduled consultation with <strong>${safeDoctor}</strong> on <strong>${safeDate} at ${safeTime}</strong> has been cancelled in our clinic records.
            </p>
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 0 0 20px 0; font-size: 14px;">
              <p style="margin: 0 0 6px 0; color: #64748b;"><strong>Reference ID:</strong> ${escapeHtml(appointmentId)}</p>
              <p style="margin: 0 0 6px 0; color: #64748b;"><strong>Physician:</strong> ${safeDoctor}</p>
              <p style="margin: 0; color: #64748b;"><strong>Original Time:</strong> ${safeDate} at ${safeTime}</p>
            </div>
            <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 20px 0;">
              We understand that plans can change. Whenever you are ready to reschedule or need medical assistance, our clinic desk is here to welcome you.
            </p>
            <p style="font-size: 14px; line-height: 1.5; color: #334155; margin: 0;">
              Wishing you good health and well-being,<br/>
              <strong>Clinic Desk Healthcare Team</strong>
            </p>
          </div>
        </div>
      `;
    } else {
      emailSubject = `Clinic Desk · ${isOnline ? "Telehealth Consultation" : "In-Person Consultation"} Confirmed · ${name} with ${doctor} · ${date}`;
      emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; color: #1e293b; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <!-- Header Banner -->
          <div style="background: linear-gradient(135deg, #0d9488 0%, #0891b2 100%); padding: 28px 24px; color: #ffffff; text-align: center;">
            <h1 style="margin: 0 0 6px 0; font-size: 24px; font-weight: 700; letter-spacing: -0.02em;">Clinic Desk Healthcare</h1>
            <p style="margin: 0; font-size: 14px; opacity: 0.95; font-weight: 400;">Compassionate Medical Care & Consultation</p>
          </div>

          <div style="padding: 28px 24px;">
            <!-- Kindful Opening Message -->
            <p style="font-size: 16px; margin: 0 0 16px 0;">Dear <strong>${safeName}</strong>,</p>
            <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 20px 0;">
              We hope this message finds you in good health and peaceful spirits. It is our pleasure to confirm that your consultation with <strong>${safeDoctor}</strong> has been successfully scheduled and securely recorded in our clinic care registry.
            </p>

            <!-- Consultation Details Card -->
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 0 0 24px 0;">
              <h3 style="margin: 0 0 14px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; font-weight: 700;">Consultation Summary</h3>
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tbody>
                  <tr>
                    <td style="padding: 6px 0; color: #64748b; width: 140px;">Patient:</td>
                    <td style="padding: 6px 0; font-weight: 600; color: #0f172a;">${safeName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #64748b;">Attending Doctor:</td>
                    <td style="padding: 6px 0; font-weight: 600; color: #0d9488;">${safeDoctor}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #64748b;">Date:</td>
                    <td style="padding: 6px 0; font-weight: 600; color: #0f172a;">${safeDate}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #64748b;">Time Slot:</td>
                    <td style="padding: 6px 0; font-weight: 600; color: #0f172a;">${safeTime}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #64748b;">Consultation Mode:</td>
                    <td style="padding: 6px 0; font-weight: 600; color: ${isOnline ? "#0284c7" : "#059669"};">
                      ${isOnline ? "Online Telehealth Consultation" : "In-Person Clinic Visit"}
                    </td>
                  </tr>
                  ${phone ? `<tr><td style="padding: 6px 0; color: #64748b;">Contact Phone:</td><td style="padding: 6px 0; color: #0f172a;">${escapeHtml(phone)}</td></tr>` : ""}
                  ${bloodGroup ? `<tr><td style="padding: 6px 0; color: #64748b;">Blood Group:</td><td style="padding: 6px 0; color: #0f172a;">${escapeHtml(bloodGroup)}</td></tr>` : ""}
                  ${notes ? `<tr><td style="padding: 6px 0; color: #64748b; vertical-align: top;">Clinical Notes:</td><td style="padding: 6px 0; color: #334155;">${escapeHtml(notes)}</td></tr>` : ""}
                </tbody>
              </table>
            </div>

            <!-- Online / Offline Specific Block -->
            ${
              isOnline
                ? `
              <!-- ONLINE TELEHEALTH WITH ZOOM LINK -->
              <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-left: 5px solid #16a34a; border-radius: 8px; padding: 20px; margin: 0 0 24px 0;">
                <h3 style="margin: 0 0 10px 0; font-size: 16px; color: #166534; font-weight: 700;">Telehealth Video Consultation Link</h3>
                <p style="margin: 0 0 14px 0; font-size: 14px; line-height: 1.5; color: #14532d;">
                  Your digital consultation room is prepared. Please use the button below to join ${safeDoctor} at your appointed time:
                </p>
                <div style="text-align: center; margin: 16px 0;">
                  <a href="${escapeHtml(zoomUrl || `https://zoom.us/j/${zoomId}?pwd=CLINIC`)}" style="background-color: #16a34a; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 15px; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" target="_blank">
                    Join Zoom Video Consultation
                  </a>
                </div>
                <div style="margin: 10px 0 0 0; font-size: 13px; color: #15803d; text-align: center;">
                  ${zoomUrl ? `<strong>Direct Link:</strong> <a href="${escapeHtml(zoomUrl)}" style="color: #0369a1; word-break: break-all;">${escapeHtml(zoomUrl)}</a><br/>` : ""}
                  ${zoomId ? `<strong>Meeting ID:</strong> ${escapeHtml(zoomId)}` : ""}
                </div>
                <div style="margin-top: 14px; padding-top: 12px; border-top: 1px dashed #bbf7d0; font-size: 12px; color: #166534; line-height: 1.4;">
                  <strong>Helpful Tips:</strong> Please join 5 minutes early to test your audio and video. Find a quiet, well-lit space and keep any medical reports or prescriptions nearby.
                </div>
              </div>
            `
                : `
              <!-- OFFLINE IN-PERSON VISIT WITHOUT ZOOM LINK -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 5px solid #0284c7; border-radius: 8px; padding: 20px; margin: 0 0 24px 0;">
                <h3 style="margin: 0 0 10px 0; font-size: 16px; color: #0369a1; font-weight: 700;">In-Person Clinic Visit Instructions</h3>
                <p style="margin: 0 0 8px 0; font-size: 14px; line-height: 1.5; color: #1e293b;">
                  <strong>Clinic Location:</strong><br/>
                  ${escapeHtml(clinicAddress)}
                </p>
                <p style="margin: 8px 0 0 0; font-size: 13px; line-height: 1.5; color: #475569;">
                  <strong>Visiting Guidelines:</strong> Please arrive 10 to 15 minutes before your consultation for initial check-in and vital signs check. Valet parking and patient assistance are available at our main entrance.
                </p>
              </div>
            `
            }

            <!-- Kindful Reassurance -->
            <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 20px 0;">
              Your health, comfort, and peace of mind are always our highest priorities. Should you have any questions or feel unwell prior to your visit, please do not hesitate to contact our care team immediately.
            </p>

            <!-- Care Continuity Action Links -->
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; margin: 0 0 24px 0; text-align: center; font-size: 13px;">
              <span style="color: #64748b; font-weight: 600; display: block; margin-bottom: 6px;">Manage Your Appointment:</span>
              <a href="${actionUrl("confirm")}" style="color: #0d9488; text-decoration: none; font-weight: 600; margin: 0 10px;">Confirm Appointment</a> |
              <a href="${actionUrl("reschedule")}" style="color: #0284c7; text-decoration: none; font-weight: 600; margin: 0 10px;">Request Reschedule</a> |
              <a href="${actionUrl("cancel")}" style="color: #e11d48; text-decoration: none; font-weight: 600; margin: 0 10px;">Cancel Visit</a>
            </div>

            <!-- Sign-off -->
            <p style="font-size: 14px; line-height: 1.5; color: #334155; margin: 0;">
              Wishing you sound health and gentle healing,<br/>
              <strong>Clinic Desk Healthcare Team</strong><br/>
              <span style="font-size: 12px; color: #64748b;">In care partnership with ${safeDoctor}</span>
            </p>
          </div>
        </div>
      `;
    }

    // 7. Dispatch Patient Notification Ticket (Freshdesk emails Patient as Requester)
    const patientTicket = await createFollowupTicket({
      email,
      name,
      ccEmails: [],
      subject: emailSubject,
      description: emailHtml,
      priority: 2,
      tags: [
        isCancelled ? "clinic_appointment_cancelled" : "clinic_appointment",
        mode.toLowerCase(),
        `appointment_${appointmentId}`,
        "patient_notification",
      ],
    });

    // Auto-fill Ticket ID in Airtable as soon as email is sent
    if (appointmentId && patientTicket?.id) {
      try {
        await saveAirtableRecord(appointmentId, {
          [COL.ticketId]: String(patientTicket.id),
        });
      } catch (ticketSaveErr) {
        console.warn("Could not auto-fill Ticket ID in Airtable appointment:", ticketSaveErr);
      }
    }

    // 8. Dispatch Doctor Notification Ticket (Freshdesk emails Doctor directly as Requester)
    let doctorTicket: any = null;
    if (doctorEmail && doctorEmail.toLowerCase() !== email.toLowerCase()) {
      try {
        const doctorSubject = isCancelled
          ? `Clinic Desk · Consultation Cancelled · Patient: ${name} · ${date}`
          : `Clinic Desk · New Consultation Scheduled · Patient: ${name} (${mode}) · ${date} at ${time}`;

        const doctorEmailHtml = isCancelled
          ? `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; color: #1e293b; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
              <div style="background: linear-gradient(135deg, #475569 0%, #334155 100%); padding: 24px; color: #ffffff; text-align: center;">
                <h1 style="margin: 0 0 6px 0; font-size: 22px; font-weight: 700;">Clinic Desk Healthcare</h1>
                <p style="margin: 0; font-size: 14px; opacity: 0.9;">Physician Notice: Consultation Cancelled</p>
              </div>
              <div style="padding: 24px;">
                <p style="font-size: 16px; margin: 0 0 16px 0;">Dear <strong>${safeDoctor}</strong>,</p>
                <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 20px 0;">
                  This is to notify you that the consultation with patient <strong>${safeName}</strong> scheduled for <strong>${safeDate} at ${safeTime}</strong> has been cancelled. Your schedule slot has been updated and released.
                </p>
                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 0 0 20px 0; font-size: 14px;">
                  <p style="margin: 0 0 6px 0; color: #64748b;"><strong>Patient:</strong> ${safeName}</p>
                  <p style="margin: 0 0 6px 0; color: #64748b;"><strong>Patient Email:</strong> ${email}</p>
                  ${phone ? `<p style="margin: 0 0 6px 0; color: #64748b;"><strong>Phone:</strong> ${escapeHtml(phone)}</p>` : ""}
                  <p style="margin: 0; color: #64748b;"><strong>Cancelled Slot:</strong> ${safeDate} at ${safeTime}</p>
                </div>
                <p style="font-size: 14px; line-height: 1.5; color: #334155; margin: 0;">
                  Best regards,<br/>
                  <strong>Clinic Desk Scheduling System</strong>
                </p>
              </div>
            </div>
          `
          : `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; color: #1e293b; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
              <div style="background: linear-gradient(135deg, #0d9488 0%, #0891b2 100%); padding: 24px; color: #ffffff; text-align: center;">
                <h1 style="margin: 0 0 6px 0; font-size: 22px; font-weight: 700;">Clinic Desk Healthcare</h1>
                <p style="margin: 0; font-size: 14px; opacity: 0.95;">Physician Schedule Notification</p>
              </div>
              <div style="padding: 24px;">
                <p style="font-size: 16px; margin: 0 0 16px 0;">Dear <strong>${safeDoctor}</strong>,</p>
                <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 20px 0;">
                  A clinical consultation has been scheduled with you for patient <strong>${safeName}</strong>.
                </p>
                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin: 0 0 20px 0; font-size: 14px;">
                  <h3 style="margin: 0 0 12px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; font-weight: 700;">Consultation Details</h3>
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr><td style="padding: 5px 0; color: #64748b; width: 140px;">Patient Name:</td><td style="padding: 5px 0; font-weight: 600; color: #0f172a;">${safeName}</td></tr>
                    <tr><td style="padding: 5px 0; color: #64748b;">Patient Email:</td><td style="padding: 5px 0; color: #0284c7;">${email}</td></tr>
                    ${phone ? `<tr><td style="padding: 5px 0; color: #64748b;">Contact Phone:</td><td style="padding: 5px 0; color: #0f172a;">${escapeHtml(phone)}</td></tr>` : ""}
                    ${bloodGroup ? `<tr><td style="padding: 5px 0; color: #64748b;">Blood Group:</td><td style="padding: 5px 0; color: #0f172a;">${escapeHtml(bloodGroup)}</td></tr>` : ""}
                    <tr><td style="padding: 5px 0; color: #64748b;">Date & Time:</td><td style="padding: 5px 0; font-weight: 600; color: #0f172a;">${safeDate} at ${safeTime}</td></tr>
                    <tr><td style="padding: 5px 0; color: #64748b;">Consultation Mode:</td><td style="padding: 5px 0; font-weight: 600; color: ${isOnline ? "#0284c7" : "#059669"};">${isOnline ? "Online Telehealth Consultation" : "In-Person Clinic Visit"}</td></tr>
                    ${notes ? `<tr><td style="padding: 5px 0; color: #64748b; vertical-align: top;">Clinical Notes:</td><td style="padding: 5px 0; color: #334155;">${escapeHtml(notes)}</td></tr>` : ""}
                  </table>
                </div>

                ${isOnline ? `
                  <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-left: 5px solid #16a34a; border-radius: 8px; padding: 18px; margin: 0 0 20px 0;">
                    <h3 style="margin: 0 0 10px 0; font-size: 15px; color: #166534; font-weight: 700;">Host Video Consultation Link (Zoom)</h3>
                    <p style="margin: 0 0 12px 0; font-size: 14px; color: #14532d;">
                      Please click the button below to launch the video meeting at the scheduled time:
                    </p>
                    <div style="text-align: center; margin: 14px 0;">
                      <a href="${escapeHtml(zoomUrl || `https://zoom.us/j/${zoomId}?pwd=CLINIC`)}" style="background-color: #16a34a; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 14px; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" target="_blank">
                        Start Video Consultation (Host)
                      </a>
                    </div>
                    <div style="margin: 8px 0 0 0; font-size: 13px; color: #15803d; text-align: center;">
                      ${zoomUrl ? `<strong>Direct Link:</strong> <a href="${escapeHtml(zoomUrl)}" style="color: #0369a1; word-break: break-all;">${escapeHtml(zoomUrl)}</a><br/>` : ""}
                      ${zoomId ? `<strong>Meeting ID:</strong> ${escapeHtml(zoomId)}` : ""}
                    </div>
                  </div>
                ` : `
                  <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 5px solid #0284c7; border-radius: 8px; padding: 16px; margin: 0 0 20px 0;">
                    <h3 style="margin: 0 0 6px 0; font-size: 15px; color: #0369a1; font-weight: 700;">In-Person Clinic Consultation</h3>
                    <p style="margin: 0; font-size: 13px; color: #334155;">
                      Location: ${escapeHtml(clinicAddress)}. Patient has been instructed to arrive 10-15 minutes prior for vitals and check-in.
                    </p>
                  </div>
                `}

                <p style="font-size: 14px; line-height: 1.5; color: #334155; margin: 0;">
                  Warm regards,<br/>
                  <strong>Clinic Desk Scheduling System</strong>
                </p>
              </div>
            </div>
          `;

        doctorTicket = await createFollowupTicket({
          email: doctorEmail,
          name: doctor,
          ccEmails: [],
          subject: doctorSubject,
          description: doctorEmailHtml,
          priority: 2,
          tags: [
            isCancelled ? "clinic_appointment_cancelled" : "clinic_appointment",
            mode.toLowerCase(),
            `appointment_${appointmentId}`,
            "doctor_notification",
          ],
        });
      } catch (docErr) {
        console.warn("Could not dispatch doctor notification ticket:", docErr);
      }
    }

    return NextResponse.json({
      ok: true,
      patientTicketId: patientTicket.id,
      doctorTicketId: doctorTicket?.id || null,
      patientEmail: email,
      doctorEmail,
      mode,
      hasZoom: isOnline && Boolean(zoomUrl || zoomId),
      freshserviceTicketId: (patientTicket as any).freshserviceTicketId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not dispatch appointment email.";
    console.error("Appointment email route error:", error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
