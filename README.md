This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Clinic appointments and follow-ups

The receptionist books an existing patient with one of the eleven doctors in the backend directory. The dropdown includes each doctor's name and specialty. For doctor logins, add the doctor's real email and password to `CLINIC_USERS_JSON` with `role: "doctor"` and a matching `doctorName`. The account filters appointments by doctor name.

Example account entry: `{"email":"doctor@clinic.com","password":"set-a-private-password","role":"doctor","name":"Dr. Ananya Rao","doctorName":"Dr. Ananya Rao"}`. Configure each doctor's actual email this way to enable their login and appointment email delivery.

Set these values in the server environment (for local development, `.env.local`):

- `FRESHDESK_DOMAIN`, `FRESHDESK_API_KEY`, and `FRESHDESK_COMPANY_ID` to send appointment and follow-up email through Freshdesk. The company ID is the Freshdesk **Clinic Desk** company used for ticket creation.
- `NEXT_PUBLIC_APP_URL` to the public HTTPS address of this app so patient links work outside the clinic network.
- `CLINIC_SESSION_SECRET` must remain stable and contain at least 32 characters; appointment and follow-up links use it to encrypt their short-lived tokens.
- `ZOOM_ACCOUNT_ID`, `ZOOM_USER_ID` (the clinic meeting host's Zoom email or user ID), `ZOOM_CLIENT_ID`, and `ZOOM_CLIENT_SECRET` from a Zoom Server-to-Server OAuth app with the meeting master scopes. Keep these server-side; do not put them in Clinic Settings or browser storage. The app requests and uses OAuth tokens on the server when it creates, updates, or deletes online appointment meetings.

All integration credentials stay on the server. Configure these additional values in `.env.local` or the deployment environment:

- `AIRTABLE_TOKEN`, `AIRTABLE_BASE_ID`, and `AIRTABLE_TABLE_ID` for patient and appointment records. Airtable must have the existing patient and appointment fields, plus `Mode`, `Zoom Meeting ID`, `Zoom Join URL`, `Google Calendar Event ID`, `Follow-up Start`, and `Follow-up Day` fields. New records are created through authenticated server routes.
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, and `GOOGLE_CALENDAR_ID` for Google Calendar. `GOOGLE_PRIVATE_KEY` accepts the full PEM `private_key` from the service-account JSON or base64-encoded PKCS#8 DER. Share the target calendar with the service account and grant it permission to manage events.
- `CRON_SECRET`, a long random value used to protect `/api/cron/follow-ups`.
- `CLINIC_ADDRESS` for the in-person appointment email. If unset, the email asks the patient to contact the clinic for directions.

Online appointments create or update a Zoom meeting, every appointment creates or updates a Google Calendar event, and Freshdesk sends the appointment email. The email includes a Zoom join link for online visits and the date/time/location details for in-person visits. Enable Freshdesk requester and CC email notifications so patients and the assigned doctor receive those messages. Appointment action links still send confirmation, cancellation, and reschedule requests to the clinic inbox.

The Vercel schedule in `vercel.json` calls the protected follow-up endpoint once per day to fit the Hobby plan limit; follow-up delivery may therefore be delayed compared with a more frequent schedule. The endpoint starts the first feedback email after the appointment end time, then sends one email per day for seven days. On another host, configure its scheduler to request `GET /api/cron/follow-ups` every five minutes with `Authorization: Bearer <CRON_SECRET>`. Follow-up delivery is automatic; the doctor can also use **Discharge & follow-up** to send the next due email manually. Patient ratings and health updates appear in the shared follow-up inbox for both staff roles.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
# patient-db
