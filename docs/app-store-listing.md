# Didi — App Store Connect Listing (iOS)

Paste-ready copy for the App Store submission. Bundle ID `com.ghdidi.app`.
Review/adjust before submitting — fill every `REPLACE_*` placeholder.

---

## App information

- **Name (30 char max):** Didi
- **Subtitle (30 char max):** Order food, pay with MoMo
- **Primary category:** Food & Drink
- **Secondary category:** Shopping
- **Age rating:** 4+ (no objectionable content)
- **Price:** Free

> Note: "Didi" alone may be too generic for App Store search/uniqueness. If the
> name is taken or rejected, fall back to **"Didi — Food Delivery"** or
> **"Didi Ghana"** and put the keyword in the subtitle.

---

## Promotional text (170 char max — editable without resubmission)

Get your favourite Ghanaian dishes delivered fast. Browse local kitchens, order
in a tap, and pay with Mobile Money or card. Fresh jollof is closer than you think.

---

## Description (4000 char max)

Didi brings Ghana's best local kitchens, chop bars, and restaurants to your
phone. Browse menus, build your order, and pay the way you already do — Mobile
Money or card — then track it to your door.

WHY DIDI

• Order in a few taps — clean, fast menus built for Ghanaian food, from jollof
  and waakye to banku, fufu, and grilled tilapia.
• Pay your way — Mobile Money (MTN, Vodafone/Telecel, AirtelTigo) and cards,
  powered by ExpressPay. No cash needed.
• Real-time order updates — get a push notification the moment your order is
  confirmed, prepared, and on its way.
• Delivery to you — set your location and we calculate delivery fairly by
  distance, so you always know the cost up front.
• Discover nearby kitchens — find restaurants and home kitchens around you and
  reorder your favourites in seconds.
• Built for Ghana's networks — fast, lightweight, and designed to work smoothly
  even on slower connections.

FOR EVERY CRAVING
Whether it's a quick lunch from the chop bar down the road or a full family meal
on the weekend, Didi makes ordering simple and getting it delivered effortless.

Download Didi and order your next meal in minutes.

REPLACE_SUPPORT_NOTE: add a line about coverage areas (e.g. "Currently serving
Accra and Kumasi") once confirmed.

---

## Keywords (100 char max, comma-separated, no spaces)

food,delivery,ghana,jollof,restaurant,momo,mobile money,takeout,chop bar,waakye,accra,order

---

## URLs

- **Support URL (required):** https://ghdidi.com/support  ← REPLACE if different
- **Marketing URL (optional):** https://ghdidi.com
- **Privacy Policy URL (REQUIRED):** https://ghdidi.com/privacy  ← MUST exist and be live

---

## What's New (version notes for 1.x)

First release of Didi on iOS. Order from local Ghanaian kitchens, pay with
Mobile Money or card, and track your delivery in real time.

---

## Screenshots (required)

Mandatory size: **6.7" iPhone — 1290 × 2796 px** (iPhone 15/16 Pro Max).
Provide 3–6. Suggested sequence:

1. Storefront / restaurant list (the discovery screen)
2. A menu with appetising food photos
3. Cart / checkout showing MoMo + card payment
4. Order tracking with live status
5. Order confirmation / push notification

Tip: add a short caption overlay to each (e.g. "Pay with Mobile Money",
"Track every order"). Keep text in the top third.

---

## App Privacy (data collection questionnaire)

Declare accurately — the app collects these. Mismatches cause rejection.

| Data type | Collected? | Linked to user | Used for tracking | Purpose |
|---|---|---|---|---|
| Name | Yes | Yes | No | App functionality (orders) |
| Email address | Yes | Yes | No | Account, order receipts |
| Phone number | Yes | Yes | No | Account, order/delivery contact |
| Precise location | Yes | Yes | No | Delivery address & fee calculation |
| Purchase history | Yes | Yes | No | Order history |
| Payment info | Handled by ExpressPay | — | — | Processed by payment provider, not stored by app |
| Device ID / push token | Yes | Yes | No | Push notifications |

If you do NOT run third-party ad/analytics SDKs that track users across apps,
answer "No" to App Tracking Transparency. Confirm before submitting.

---

## Notes for Reviewer (App Review Information — IMPORTANT)

This field is the single biggest lever for avoiding a Guideline 4.2 rejection.
Paste something like the below, with a working demo account.

```
Thank you for reviewing Didi.

Didi is a native food-ordering app for the Ghanaian market. The user interface
is bundled inside the app (static build) and renders locally — it is not a
website wrapper. The app uses native iOS capabilities, including:

• Push Notifications (APNs) for real-time order status updates
• Location services to set the delivery address and calculate delivery fees
• Native payment via ExpressPay (Mobile Money + card) for Ghana

DEMO ACCOUNT
Email/phone: REPLACE_DEMO_LOGIN
Password/OTP: REPLACE_DEMO_PASSWORD
(If login uses phone OTP, provide a test number with a fixed code, or a
 pre-provisioned account that bypasses OTP for review.)

HOW TO TEST A FULL ORDER
1. Open the app — you'll see nearby kitchens/restaurants.
2. Tap a restaurant, add an item to the cart, go to checkout.
3. Set a delivery location (Accra works well, e.g. REPLACE_TEST_ADDRESS).
4. At payment, use the ExpressPay sandbox/test details below:
   REPLACE_PAYMENT_TEST_DETAILS
5. After payment you'll receive an order confirmation and push update.

Payments are processed by ExpressPay, a licensed Ghanaian payment provider.
For any access issues, contact REPLACE_CONTACT_EMAIL / REPLACE_CONTACT_PHONE.
```

---

## Pre-submission checklist

- [ ] App record created in App Store Connect for `com.ghdidi.app`
- [ ] Privacy Policy URL is live and reachable
- [ ] `MARKETING_VERSION` bumped to an unused version (currently 1.1)
- [ ] Build uploaded to TestFlight via `git tag build-N && git push origin build-N`
- [ ] Build tested on a real device (static-export navigation, login, payment, push)
- [ ] Export compliance answered (standard HTTPS → usually exempt)
- [ ] Screenshots uploaded (6.7" mandatory)
- [ ] App Privacy questionnaire completed accurately
- [ ] Demo account + reviewer notes filled in (no REPLACE_* left)
- [ ] Manual release selected (recommended for first launch)
