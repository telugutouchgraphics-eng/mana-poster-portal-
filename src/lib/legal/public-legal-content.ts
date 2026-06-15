export const SUPPORT_EMAIL = "manaposter2026@gmail.com";

export const LEGAL_LAST_UPDATED = "June 15, 2026";

export const privacySections = [
  {
    title: "Information We Collect",
    body:
      "Mana Poster Ai app and portal use account details such as name, email address, phone number, profile photo, login identifiers, purchase status, poster profile details, notification tokens, upload review data, and device or session information required to operate the service.",
  },
  {
    title: "How We Use Data",
    body:
      "We use collected data to authenticate users, protect account access, personalize posters, deliver subscriptions, restore purchases, review uploads, prevent abuse, and provide customer support. If a user enables optional location access in the app, we use Android native location permission and store only approximate city, district, state, country code, update time, and a random feed seed to prioritize nearby statuses and provide privacy-safe aggregate admin insights. Exact GPS latitude/longitude is not stored or displayed for this feature.",
  },
  {
    title: "Community Uploads and Review",
    body:
      "Users may upload poster images for manager review. We may process the uploaded image, selected category, upload time, applicable visibility date, review status, rejection reason, contribution share and download counts, and related moderation history. Approved uploads may become visible to other users in the related category. Managers and admins may review, reject, remove, or retain uploads as part of moderation, abuse prevention, and record-keeping.",
  },
  {
    title: "Payments, Firebase, and Ads",
    body:
      "The service uses Firebase Authentication, Firestore, Storage, Messaging, Analytics, Crashlytics, Google Sign-In, Google Play Billing, and AdMob. We store only the information reasonably needed for entitlement checks, restore flows, service reliability, moderation, and billing support. Ad and analytics providers may process device identifiers, IP address, and usage signals according to their own policies.",
  },
  {
    title: "Data Sharing",
    body:
      "We do not sell personal data. Data may be shared only with essential service providers, lawful authorities, or where reasonably necessary for billing, moderation, fraud prevention, security, or legal compliance.",
  },
  {
    title: "User Controls and Account Deletion",
    body:
      "Users can request account deletion from inside the app or by contacting support. After deletion, login access, poster profile details, and linked app data may be removed. Some billing, tax, anti-fraud, security, or platform-required records may be retained for a limited period where legally required or reasonably necessary.",
  },
  {
    title: "Reporting and Abusive Content",
    body:
      `If you see abusive, infringing, impersonating, deceptive, political-misuse, privacy-violating, or spam content, you can report it through the in-app report flow, app support flow, or by emailing ${SUPPORT_EMAIL}. Status/reply reports may include the report reason, optional details, reporter account details, reported content previews, approximate location fields if enabled on the reported status, moderation action notes, close/re-open history, and user email update records. Complaints, moderation decisions, review evidence, and limited enforcement records may be retained for abuse prevention, legal compliance, and user safety.`,
  },
] as const;

export const termsSections = [
  {
    title: "Using the Service",
    body:
      "Mana Poster Ai is intended for personal, business, and promotional poster creation. You must use the app and portal lawfully and responsibly.",
  },
  {
    title: "Account and Content Responsibility",
    body:
      "You must keep your login details secure. You must have the right to use any photos, text, logos, or poster materials you upload. Illegal, deceptive, hateful, obscene, infringing, impersonating, or privacy-violating content is prohibited.",
  },
  {
    title: "Subscriptions, Cancellation, and Refunds",
    body:
      "Certain app features require an active subscription. Trial and paid plans, if offered, renew automatically unless cancelled through the Google Play subscription management screen before the renewal date. Refund eligibility is subject to Google Play policies and applicable law.",
  },
  {
    title: "Community Uploads, Moderation, and Reporting",
    body:
      `Users may upload posters for manager review. Uploading third-party content without rights, impersonation, abusive or offensive content, deceptive political misuse, spam uploads, repeated low-quality uploads, illegal notices, fake claims, or material you do not have rights to use is prohibited. Managers and admins may approve, reject, customize, delay, unpublish, or remove uploads. Rejected uploads may include a reason. Abusive or infringing status/reply content can be reported through the in-app report flow, app support flow, or by emailing ${SUPPORT_EMAIL}. Managers and admins may review reports, send reasonable email updates to the reporter, close reports after action, or re-open reports if further review is needed. Admin location insights are aggregate city/district/state views only and must not be used as exact user tracking.`,
  },
  {
    title: "Manager and Admin Review Authority",
    body:
      "To protect users and the platform, managers and admins may review uploaded posters, hold publication, reject or remove policy-violating material, preserve moderation history, and restrict access where fraud, abuse, or legal risk is detected.",
  },
  {
    title: "Device Sessions",
    body:
      "For account security, one account may remain active on only one primary device session at a time. If the same account is activated on another primary device, the previous session may be signed out. This helps reduce account misuse and unauthorized access.",
  },
  {
    title: "Ads and Third-Party Services",
    body:
      "Some parts of the service depend on Google Play, Firebase, AdMob, and other third-party systems. Their availability, billing events, notifications, or ad delivery may affect how quickly some features update.",
  },
  {
    title: "Service Changes and Enforcement",
    body:
      "Features, pricing, designs, ads, moderation rules, and these terms may change over time. We may suspend, restrict, or remove access where fraud, abuse, policy violations, or illegal usage is detected.",
  },
] as const;
