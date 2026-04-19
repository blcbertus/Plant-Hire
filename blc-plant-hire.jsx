import { useState, useEffect, useRef, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const ADMIN_PASSWORD = "BLC@Admin2026";
const STORAGE_KEY    = "blc_listings_v4";
const INTERESTS_KEY  = "blc_interests_v1";
const RATINGS_KEY    = "blc_ratings_v1";
const CHAT_KEY       = "blc_chat_v1";
const ADS_KEY        = "blc_ads_v1";
const BOOKINGS_KEY   = "blc_bookings_v1";
const BIDS_KEY       = "blc_bids_v1";
const REQUESTS_KEY   = "blc_requests_v1";
const WANTED_KEY     = "blc_wanted_v1";
const ANALYTICS_KEY  = "blc_analytics_v1";

function loadAnalytics(){ try{return JSON.parse(localStorage.getItem(ANALYTICS_KEY)||"{}")}catch{return{}} }
function saveAnalytics(d){ try{localStorage.setItem(ANALYTICS_KEY,JSON.stringify(d));}catch{} }

function trackEvent(type, meta={}) {
  try {
    const data = loadAnalytics();
    const today = new Date().toISOString().split("T")[0];
    if (!data.events) data.events = [];
    data.events.push({ type, meta, ts: Date.now(), date: today });
    // cap at 2000 events to stay within localStorage limits
    if (data.events.length > 2000) data.events = data.events.slice(-2000);
    saveAnalytics(data);
  } catch {}
}

function loadBookings(){ try{return JSON.parse(localStorage.getItem(BOOKINGS_KEY)||"[]");}catch{return[];} }
function saveBookings(d){ try{localStorage.setItem(BOOKINGS_KEY,JSON.stringify(d));}catch{} }

// ── BIDS ─────────────────────────────────────────────────────────────────────
function loadBids(){ try{return JSON.parse(localStorage.getItem(BIDS_KEY)||"[]");}catch{return[];} }
function saveBids(d){ try{localStorage.setItem(BIDS_KEY,JSON.stringify(d));}catch{} }

function highestBidForListing(bids, listingId) {
  const listingBids = bids.filter(b => b.listingId===listingId && b.status!=="rejected" && b.status!=="withdrawn");
  if (!listingBids.length) return null;
  return listingBids.reduce((max, b) => b.amount > (max?.amount||0) ? b : max, null);
}

function bidCountForListing(bids, listingId) {
  return bids.filter(b => b.listingId===listingId && b.status!=="rejected" && b.status!=="withdrawn").length;
}

function genBidRef(id) { return "BLC-B" + (id||"").slice(-6).toUpperCase(); }

// ── BUYER REQUESTS (Wanted Board) ────────────────────────────────────────────
// Buyers can post what they're looking for. Public sees only the request details,
// NOT the buyer's name/contact. Only admin sees the full contact info.
function loadRequests(){ try{return JSON.parse(localStorage.getItem(REQUESTS_KEY)||"[]");}catch{return[];} }
function saveRequests(d){ try{localStorage.setItem(REQUESTS_KEY,JSON.stringify(d));}catch{} }
function genRequestRef(id) { return "BLC-W" + (id||"").slice(-6).toUpperCase(); }

// Seed requests so the Wanted board is never empty
const SEED_REQUESTS = [
  { id:"req_seed1", category:"Excavator", description:"Looking for a 20-30 ton excavator for hire in Khomas region. Short-term project (2-3 months). Must be in good working condition with recent service records.", region:"Khomas", budgetMin:3500, budgetMax:5500, unit:"day", requestType:"hire", urgency:"within_month", buyerName:"Private Buyer", buyerPhone:"+264 81 XXX XXXX", buyerEmail:"", status:"approved", submittedAt:Date.now()-86400000*3, approvedAt:Date.now()-86400000*2 },
  { id:"req_seed2", category:"Tipper Truck", description:"Need 2-3 tipper trucks (10-15 ton capacity) for sand/gravel hauling in Erongo. Starting immediately for 6-month contract.", region:"Erongo", budgetMin:1500, budgetMax:2500, unit:"day", requestType:"hire", urgency:"urgent", buyerName:"Private Buyer", buyerPhone:"+264 81 XXX XXXX", buyerEmail:"", status:"approved", submittedAt:Date.now()-86400000*1, approvedAt:Date.now()-86400000*1 },
  { id:"req_seed3", category:"Front-End Loader", description:"Looking to BUY a used front-end loader. Caterpillar or Komatsu preferred, max 15,000 hours. Willing to travel nationwide to view.", region:"Otjozondjupa", budgetMin:450000, budgetMax:800000, unit:"fixed", requestType:"sale", urgency:"flexible", buyerName:"Private Buyer", buyerPhone:"+264 81 XXX XXXX", buyerEmail:"", status:"approved", submittedAt:Date.now()-86400000*5, approvedAt:Date.now()-86400000*4 },
];

// ── WANTED / EQUIPMENT REQUESTS ──────────────────────────────────────────────
// Seed wanted requests so the page isn't empty on first load
const SEED_WANTED = [
  {
    id:"w_seed_1", category:"Excavator", region:"Khomas", location:"Windhoek",
    title:"20-30 ton excavator for construction project",
    description:"Looking for a well-maintained 20-30 ton excavator for a 6-month construction project. Prefer Cat, Komatsu, or Volvo. Must be in good working condition with service history.",
    budget:"N$2M - N$3.5M", purpose:"buy", urgency:"within_month",
    name:"Construction Company (verified)", phone:"+264 81 000 0001", email:"buyer1@hidden.com",
    status:"approved", submittedAt:Date.now()-86400000*2, views:47,
  },
  {
    id:"w_seed_2", category:"Tipper Truck", region:"Erongo", location:"Walvis Bay",
    title:"Need 3x 10-wheeler tippers for hire",
    description:"Require 3 tipper trucks for 3 months, moving aggregate for harbour expansion project. 10-wheeler, good condition, drivers can be provided or arranged.",
    budget:"N$1,500-2,000/day per truck", purpose:"hire", urgency:"urgent",
    name:"Mining Contractor (verified)", phone:"+264 81 000 0002", email:"buyer2@hidden.com",
    status:"approved", submittedAt:Date.now()-86400000*5, views:23,
  },
  {
    id:"w_seed_3", category:"Grader", region:"Otjozondjupa", location:"Otjiwarongo",
    title:"Grader wanted for farm road maintenance",
    description:"Farm owner needs a motor grader for regular road maintenance on 4000ha property. Either buy outright or long-term rental (6+ months). Cat 140H / 140M or similar.",
    budget:"N$800k - N$1.5M (buy) or N$18k/month (hire)", purpose:"either", urgency:"flexible",
    name:"Commercial Farmer (verified)", phone:"+264 81 000 0003", email:"buyer3@hidden.com",
    status:"approved", submittedAt:Date.now()-86400000*8, views:15,
  },
];

function loadWanted(){ 
  try{
    const stored = JSON.parse(localStorage.getItem(WANTED_KEY)||"null");
    if (stored && stored.length > 0) return stored;
    localStorage.setItem(WANTED_KEY, JSON.stringify(SEED_WANTED));
    return SEED_WANTED;
  }catch{return SEED_WANTED;} 
}
function saveWanted(d){ try{localStorage.setItem(WANTED_KEY,JSON.stringify(d));}catch{} }
function genWantedRef(id){ return "BLC-W" + (id||"").slice(-6).toUpperCase(); }

// Check if a date range overlaps any confirmed booking for a listing
function isDateRangeBooked(bookings, listingId, startDate, endDate) {
  const listingBookings = bookings.filter(b => b.listingId===listingId && b.status==="confirmed");
  const s = new Date(startDate); const e = new Date(endDate);
  return listingBookings.some(b => {
    const bs = new Date(b.startDate); const be = new Date(b.endDate);
    return s <= be && e >= bs;
  });
}

// Get all booked date ranges for a listing
function getBookedRanges(bookings, listingId) {
  return bookings.filter(b => b.listingId===listingId && b.status==="confirmed")
    .map(b => ({ start: new Date(b.startDate), end: new Date(b.endDate) }));
}

// ── AD SLOTS ──────────────────────────────────────────────────────────────────
const AD_SLOTS = {
  hero_banner:   { id:"hero_banner",   label:"Hero Banner",        desc:"Full-width rotating banner at top of browse page. Unlimited advertisers rotate every 2 min.",   price:700, size:"1200×200px" },
  inline_card:   { id:"inline_card",   label:"Inline Card Ad",     desc:"Appears between every 6th listing card in grid. Unlimited advertisers rotate every 2 min.",     price:400, size:"300×200px"  },
  footer_strip:  { id:"footer_strip",  label:"Footer Strip",       desc:"Full-width banner just above the site footer. Unlimited advertisers rotate every 2 min.",       price:250, size:"1200×100px" },
  modal_sponsor: { id:"modal_sponsor", label:"Modal Sponsor",      desc:"Sponsored-by box inside every listing modal. Unlimited advertisers rotate every 2 min.",        price:500, size:"400×120px"  },
};

const SEED_ADS = [
  { id:"ad1", slot:"hero_banner",   adStatus:"approved", advertiser:"Puma Energy Namibia",       tagline:"Fuel for Every Machine — Nationwide Delivery",         link:"#", bgColor:"#0d2137", textColor:"#f0c040", active:true, startDate:"2026-01-01", endDate:"2027-12-31", image:"" },
  { id:"ad2", slot:"hero_banner",   adStatus:"approved", advertiser:"NamTyres & Parts",          tagline:"OEM Tyres & Parts · All Brands · Fast Namibia Delivery", link:"#", bgColor:"#1a0800", textColor:"#ff6b1a", active:true, startDate:"2026-01-01", endDate:"2027-12-31", image:"" },
  { id:"ad3", slot:"inline_card",   adStatus:"approved", advertiser:"FNB Namibia Asset Finance", tagline:"Finance Your Next Machine — Get Approved Today",          link:"#", bgColor:"#051a10", textColor:"#22d498", active:true, startDate:"2026-01-01", endDate:"2027-12-31", image:"" },
  { id:"ad4", slot:"inline_card",   adStatus:"approved", advertiser:"Engen Petroleum Namibia",   tagline:"Engen — Keeping Namibia Moving Since 1966",              link:"#", bgColor:"#1a0505", textColor:"#ff4040", active:true, startDate:"2026-01-01", endDate:"2027-12-31", image:"" },
  { id:"ad5", slot:"footer_strip",  adStatus:"approved", advertiser:"Bank Windhoek Business",    tagline:"Business Banking Built for Namibian Entrepreneurs",       link:"#", bgColor:"#030d1a", textColor:"#60b0ff", active:true, startDate:"2026-01-01", endDate:"2027-12-31", image:"" },
  { id:"ad6", slot:"modal_sponsor", adStatus:"approved", advertiser:"Namibia Construction Expo 2026", tagline:"Africa's Premier Plant & Equipment Show · Windhoek", link:"#", bgColor:"#12042a", textColor:"#d09aff", active:true, startDate:"2026-01-01", endDate:"2027-12-31", image:"" },
  { id:"ad7", slot:"hero_banner",   adStatus:"pending",  advertiser:"Agra Namibia",                   tagline:"Agricultural & Civil Equipment — Nationwide",       link:"#", bgColor:"#0a2010", textColor:"#44cc88", active:false, startDate:"2026-05-01", endDate:"2026-10-31", image:"", contactName:"Johan van Wyk", phone:"+264 61 214 5000", email:"marketing@agra.com.na", submittedAt:Date.now()-3600000*2, months:6 },
  { id:"ad8", slot:"inline_card",   adStatus:"pending",  advertiser:"Namibia Crane & Rigging Co.",    tagline:"Certified Crane Hire · 24/7 Emergency Response",     link:"#", bgColor:"#1a1000", textColor:"#ffaa00", active:false, startDate:"2026-05-01", endDate:"2026-07-31", image:"", contactName:"Pieter Botha", phone:"+264 81 777 3322", email:"info@namicranes.com.na", submittedAt:Date.now()-3600000*5, months:3 },
];

function loadAds(){
  try {
    const raw = localStorage.getItem(ADS_KEY);
    const user = raw ? JSON.parse(raw) : [];
    // Seeds always win for their own IDs — ensures demo ads always show
    const userNonSeed = user.filter(u => !SEED_ADS.find(s => s.id === u.id));
    return [...SEED_ADS, ...userNonSeed];
  } catch { return SEED_ADS; }
}
function saveAds(d){ try{localStorage.setItem(ADS_KEY,JSON.stringify(d));}catch{} }
// Only show ads that are active, not expired, and not rejected
function activeAds(ads, slot){ return ads.filter(a => a.slot===slot && a.active && a.adStatus!=="rejected" && new Date(a.endDate)>=new Date()); }

const TIERS = {
  free:     { key:"free",     label:"Free",     price:0,   priceLabel:"N$0 / month",   photos:1, featured:false, priority:false, perks:["1 photo","Basic listing","Reviewed by BLC","Standard placement"] },
  featured: { key:"featured", label:"Featured", price:150, priceLabel:"N$150 / month", photos:2, featured:true,  priority:false, perks:["2 photos","Featured badge & ribbon","Top of search results","Reviewed within 12hrs"] },
  premium:  { key:"premium",  label:"Premium",  price:350, priceLabel:"N$350 / month", photos:6, featured:true,  priority:true,  perks:["6 photos","Premium badge","Priority placement","Reviewed within 4hrs","Highlighted in search","WhatsApp enquiry button","D83dDe80 Traffic Booster 2014 social sharing kit"] }
};

const CATEGORIES = ["Excavator","Tipper Truck","Front-End Loader","Grader","Compactor/Roller","Crane","Bulldozer","Water Tanker","Low Bed Trailer","Generator","Forklift","Concrete Mixer","Skid Steer","Motor Scraper","Pipe Layer","Other"];
const REGIONS    = ["Khomas","Erongo","Hardap","ǁKaras","Kavango East","Kavango West","Kunene","Ohangwena","Omaheke","Omusati","Oshana","Oshikoto","Otjozondjupa","Zambezi"];
const CONDITION  = ["Excellent","Good","Fair","Needs Repair"];

const BLC_BANK = { name:"BLC Suppliers and Trading", bank:"Bank Windhoek", account:"8052167764", branch:"486-372", branchName:"Capricon Branch" };

// ── LANGUAGE / I18N ──────────────────────────────────────────────────────────
const LANG_KEY = "blc_lang_v1";
const LANGUAGES = {
  en: { code:"en", label:"English",    flag:"🇬🇧" },
  af: { code:"af", label:"Afrikaans",  flag:"🇳🇦" },
  os: { code:"os", label:"Oshiwambo",  flag:"🇳🇦" },
};

const TRANSLATIONS = {
  en: {
    nav_browse:"Browse", nav_list:"List Equipment", nav_advertise:"📢 Advertise", nav_admin:"Admin",
    hero_flag:"Namibia's Plant Hire & Sales Platform", hero_title_1:"HEAVY PLANT", hero_title_2:"HIRE & SALE",
    hero_sub:"Find equipment to hire or buy across all 14 Namibian regions. Rate equipment, log interest, and chat with BLC directly.",
    hero_for_hire:"For Hire", hero_for_sale:"For Sale", hero_regions:"Regions", hero_free:"To List",
    search_label:"Search", search_placeholder:"Equipment name, location...",
    category_label:"Category", all_categories:"All Categories",
    region_label:"Region", all_regions:"All Regions",
    type_label:"Type", type_all:"Hire & Sale", type_hire:"For Hire", type_sale:"For Sale",
    listings_count:"listings", no_listings:"No listings found",
    enquire:"Enquire", sold:"Sold",
    call_blc:"Call BLC", list_equipment:"List Equipment",
    footer_line:"Namibia · All 14 Regions",
    chat_greeting:"Hi! Chat with BLC about any equipment.",
    book_now:"Book Now", view_listing:"View Listing",
    select_lang:"Language",
  },
  af: {
    nav_browse:"Blaai", nav_list:"Lys Toerusting", nav_advertise:"📢 Adverteer", nav_admin:"Admin",
    hero_flag:"Namibië se Toerusting-Huur & Verkoop Platform", hero_title_1:"SWAAR TOERUSTING", hero_title_2:"HUUR & VERKOOP",
    hero_sub:"Vind toerusting om te huur of te koop regoor al 14 Namibiese streke. Beoordeel toerusting, teken belangstelling aan, en gesels direk met BLC.",
    hero_for_hire:"Vir Huur", hero_for_sale:"Vir Verkoop", hero_regions:"Streke", hero_free:"Om Te Lys",
    search_label:"Soek", search_placeholder:"Toerusting naam, ligging...",
    category_label:"Kategorie", all_categories:"Alle Kategorieë",
    region_label:"Streek", all_regions:"Alle Streke",
    type_label:"Tipe", type_all:"Huur & Verkoop", type_hire:"Vir Huur", type_sale:"Vir Verkoop",
    listings_count:"lysings", no_listings:"Geen lysings gevind nie",
    enquire:"Navraag", sold:"Verkoop",
    call_blc:"Skakel BLC", list_equipment:"Lys Toerusting",
    footer_line:"Namibië · Al 14 Streke",
    chat_greeting:"Hallo! Gesels met BLC oor enige toerusting.",
    book_now:"Bespreek Nou", view_listing:"Bekyk Lysing",
    select_lang:"Taal",
  },
  os: {
    nav_browse:"Tala", nav_list:"Lopa Oshilongifo", nav_advertise:"📢 Shiveta", nav_admin:"Admin",
    hero_flag:"Oshinyala shaNamibia shOkuhiyiwa nOkuladhekwa", hero_title_1:"OSHILONGIFO SHINENE", hero_title_2:"HIRE & SALE",
    hero_sub:"Adha oshilongifo wetu okuhiyiwa nokukulanda moshikandjo ashihe shaNamibia. Pepa oshilongifo, nyola oniinkalamwenyo, u popye naBLC.",
    hero_for_hire:"Sh Okuhiyiwa", hero_for_sale:"Sh Okulandithwa", hero_regions:"Iitopolwa", hero_free:"Okulopa",
    search_label:"Konga", search_placeholder:"Edhina lyoshilongifo, ehala...",
    category_label:"Ongundu", all_categories:"Omagundu Agehe",
    region_label:"Oshitopolwa", all_regions:"Iitopolwa Ayihe",
    type_label:"Ondjila", type_all:"Hire nOlando", type_hire:"Sh Okuhiyiwa", type_sale:"Sh Okulandithwa",
    listings_count:"omaipopilo", no_listings:"Kape na omaipopilo ga mono",
    enquire:"Pula", sold:"Sha landwa",
    call_blc:"Ithana BLC", list_equipment:"Lopa Oshilongifo",
    footer_line:"Namibia · Iitopolwa 14 Ayihe",
    chat_greeting:"Wa uhala po! Popya naBLC kombinga yoshilongifo.",
    book_now:"Nyola Paife", view_listing:"Tala Ehololo",
    select_lang:"Elaka",
  },
};

function loadLang(){ try{ return localStorage.getItem(LANG_KEY) || "en"; }catch{ return "en"; } }
function saveLang(l){ try{ localStorage.setItem(LANG_KEY, l); }catch{} }
function t(key, lang){ return TRANSLATIONS[lang||"en"]?.[key] || TRANSLATIONS.en[key] || key; }

// ── SMS NOTIFICATIONS ────────────────────────────────────────────────────────
const SMS_LOG_KEY = "blc_sms_log_v1";

function loadSmsLog(){ try{ return JSON.parse(localStorage.getItem(SMS_LOG_KEY)||"[]"); }catch{ return []; } }
function saveSmsLog(d){ try{ localStorage.setItem(SMS_LOG_KEY, JSON.stringify(d)); }catch{} }

// Queue an SMS notification. Opens SMS app with pre-filled text.
// In production this would send via an SMS gateway API.
function queueSms(phone, message, type) {
  const log = loadSmsLog();
  const entry = { id:`sms_${Date.now()}`, phone, message, type, ts:Date.now(), sent:false };
  log.push(entry);
  if (log.length > 200) log.shift();
  saveSmsLog(log);
  return entry;
}

// Generate SMS message templates
const SMS_TEMPLATES = {
  booking_confirmed: (b) => `BLC Plant Hire: Your booking for ${b.listingName} is CONFIRMED. Quote ref: ${b.quoteRef||"BLC-Q"+b.id.slice(-6)}. Deposit N$${(b.deposit||0).toLocaleString()} due to Bank Windhoek 8052167764. Ref: ${b.quoteRef||"BLC-Q"+b.id.slice(-6)}. +264 81 603 4139`,
  booking_pending:   (b) => `BLC Plant Hire: Booking request received for ${b.listingName}. We will confirm availability within 24hrs. +264 81 603 4139`,
  booking_cancelled: (b) => `BLC Plant Hire: Your booking for ${b.listingName} has been cancelled. Contact us for questions: +264 81 603 4139`,
  listing_approved:  (l) => `BLC Plant Hire: Your listing "${l.name}" is now LIVE on the platform. View at blcplanthire.com. +264 81 603 4139`,
  listing_rejected:  (l,r) => `BLC Plant Hire: Your listing "${l.name}" needs revision. ${r||"Please contact BLC for details."} +264 81 603 4139`,
  ad_approved:       (a) => `BLC Plant Hire: Your advertisement for ${a.advertiser} is now LIVE. Thank you for advertising with BLC! +264 81 603 4139`,
  ad_rejected:       (a,r) => `BLC Plant Hire: Your ad request for ${a.advertiser} needs revision. ${r||"Please contact BLC."} +264 81 603 4139`,
  new_lead_to_owner: (l,i) => `BLC Plant Hire: New enquiry for your ${l.name} listing from ${i.name} (${i.phone}). Check your BLC admin or call them directly.`,
  bid_received:      (b,l) => `BLC Plant Hire: New bid of N$${b.amount.toLocaleString()} received on ${l.name}. Ref: ${genBidRef(b.id)}. Reply through BLC admin. +264 81 603 4139`,
  bid_accepted:      (b,l) => `BLC Plant Hire: Great news! Your bid of N$${b.amount.toLocaleString()} on ${l.name} has been ACCEPTED. Ref: ${genBidRef(b.id)}. BLC will contact you to finalize payment. +264 81 603 4139`,
  bid_rejected:      (b,l,r) => `BLC Plant Hire: Your bid of N$${b.amount.toLocaleString()} on ${l.name} was not accepted. ${r||"You may submit a higher bid."} Ref: ${genBidRef(b.id)}. +264 81 603 4139`,
  bid_outbid:        (b,l,newBid) => `BLC Plant Hire: You have been outbid on ${l.name}. Current highest bid: N$${newBid.toLocaleString()}. Your bid: N$${b.amount.toLocaleString()}. Place a higher bid at blcplanthire.com`,
};

// Trigger SMS by opening sms: URL in new window (works on mobile)
function sendSms(phone, message) {
  const cleanPhone = (phone||"").replace(/\s/g,"");
  const encoded = encodeURIComponent(message);
  // sms: URI scheme works on both iOS and Android
  try { window.open(`sms:${cleanPhone}?body=${encoded}`, "_blank"); } catch {}
}


const CAT_ICONS = { "Excavator":"🏗️","Tipper Truck":"🚛","Front-End Loader":"🚜","Grader":"⛏️","Compactor/Roller":"🔧","Crane":"🏗","Bulldozer":"🚧","Water Tanker":"💧","Low Bed Trailer":"🚚","Generator":"⚡","Forklift":"🔩","Concrete Mixer":"🔄","Skid Steer":"🚜","Motor Scraper":"⛏️","Pipe Layer":"🔩","Other":"⚙️" };

const SEED_LISTINGS = [
  { id:"seed1", status:"approved", listingType:"hire", tier:"premium", name:"Komatsu PC200 Excavator", category:"Excavator", region:"Khomas", location:"Windhoek Industrial", price:"4500", unit:"day", condition:"Good", year:"2019", hours:"3200", contact:"+264 81 234 5678", email:"hire@komatsunam.com", description:"20t excavator, fully serviced. GPS-ready. Available immediately for civil projects.", images:[], submittedAt:Date.now()-86400000*3, featured:true, negotiable:false },
  { id:"seed2", status:"approved", listingType:"hire", tier:"featured", name:"Volvo A30G Articulated Dumper", category:"Tipper Truck", region:"Erongo", location:"Swakopmund", price:"5800", unit:"day", condition:"Excellent", year:"2021", hours:"1800", contact:"+264 81 876 5432", email:"fleet@volvonam.com", description:"28t payload ADT. Excellent for mine site haulage. Operator available.", images:[], submittedAt:Date.now()-86400000*2, featured:true, negotiable:false },
  { id:"seed3", status:"approved", listingType:"hire", tier:"free", name:"CAT 950M Wheel Loader", category:"Front-End Loader", region:"Otjozondjupa", location:"Otjiwarongo", price:"3800", unit:"day", condition:"Good", year:"2018", hours:"5100", contact:"+264 85 111 2233", email:"", description:"3.0m3 bucket, 4WD, ROPS cab. Weekly rates available.", images:[], submittedAt:Date.now()-86400000, featured:false, negotiable:false },
  { id:"seed4", status:"approved", listingType:"sale", tier:"premium", name:"John Deere 672G Motor Grader", category:"Grader", region:"Khomas", location:"Windhoek", price:"2850000", unit:"fixed", condition:"Good", year:"2016", hours:"8400", contact:"+264 81 555 7890", email:"sales@gradernam.com", description:"Well-maintained grader. Full service history. GPS blade control, A/C cab.", images:[], submittedAt:Date.now()-86400000*4, featured:true, negotiable:true },
  { id:"seed5", status:"approved", listingType:"sale", tier:"featured", name:"Dynapac CA2500D Compactor", category:"Compactor/Roller", region:"Erongo", location:"Walvis Bay", price:"680000", unit:"fixed", condition:"Excellent", year:"2020", hours:"2100", contact:"+264 81 321 6543", email:"", description:"Smooth drum compactor in excellent condition. Padfoot shells included.", images:[], submittedAt:Date.now()-86400000, featured:true, negotiable:false }
];

// ─────────────────────────────────────────────────────────────────────────────
// STORAGE HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function loadListings() {
  try { const raw=localStorage.getItem(STORAGE_KEY); const user=raw?JSON.parse(raw):[]; const seeded=SEED_LISTINGS.map(s=>{const o=user.find(u=>u.id===s.id);return o?{...s,...o}:s;}); return [...seeded,...user.filter(u=>!SEED_LISTINGS.find(s=>s.id===u.id))]; } catch{return SEED_LISTINGS;}
}
function saveListings(l){ try{localStorage.setItem(STORAGE_KEY,JSON.stringify(l));}catch{} }

function loadInterests(){ try{return JSON.parse(localStorage.getItem(INTERESTS_KEY)||"[]");}catch{return[];} }
function saveInterests(d){ try{localStorage.setItem(INTERESTS_KEY,JSON.stringify(d));}catch{} }

function loadRatings(){ try{return JSON.parse(localStorage.getItem(RATINGS_KEY)||"{}");}catch{return{};} }
function saveRatings(d){ try{localStorage.setItem(RATINGS_KEY,JSON.stringify(d));}catch{} }

function loadChats(){ try{return JSON.parse(localStorage.getItem(CHAT_KEY)||"{}");}catch{return{};} }
function saveChats(d){ try{localStorage.setItem(CHAT_KEY,JSON.stringify(d));}catch{} }

function sortByTier(arr){ const o={premium:0,featured:1,free:2}; return [...arr].sort((a,b)=>(o[a.tier]||2)-(o[b.tier]||2)); }

function avgRating(ratings, listingId){ const rs=(ratings[listingId]||[]); if(!rs.length) return null; return (rs.reduce((s,r)=>s+r.stars,0)/rs.length).toFixed(1); }

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const css = `
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&family=Lato:ital,wght@0,300;0,400;0,700;1,300&display=swap');

:root {
  --sand:#c4a97d;--dune:#8b6914;--savanna:#d4760a;--horizon:#e8920c;
  --teal:#1a7a6e;--teal-light:#22a090;--earth:#1e1208;--soil:#140d04;
  --clay:#3d2910;--bark:#6b4420;--dust:#f2e8d4;--ivory:#faf5ec;
  --smoke:rgba(196,169,125,0.12);--green-ok:#2e7d32;--red-no:#b71c1c;
  --gold:#f4c430;--chat-me:#1a4a2a;--chat-admin:#1a2a4a;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{background:var(--soil);color:var(--dust);font-family:'Lato',sans-serif;min-height:100vh;line-height:1.6;}
.app{min-height:100vh;display:flex;flex-direction:column;}

/* NAV */
.nav{background:linear-gradient(180deg,rgba(20,13,4,.98) 0%,rgba(28,18,6,.98) 100%);border-bottom:3px solid var(--savanna);padding:0 28px;min-height:90px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:200;backdrop-filter:blur(14px);gap:20px;flex-wrap:wrap;}
.logo{display:flex;align-items:center;gap:16px;cursor:pointer;transition:transform .2s;padding:8px 0;}
.logo:hover{transform:scale(1.02);}
.logo-mark{display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.logo-text{display:flex;flex-direction:column;justify-content:center;line-height:1;}
.logo-name{font-family:'Oswald','Arial Black',sans-serif;font-size:26px;font-weight:900;letter-spacing:2px;white-space:nowrap;line-height:1;margin-bottom:5px;text-shadow:0 1px 2px rgba(0,0,0,.6);}
.logo-sub{font-size:10px;letter-spacing:3px;text-transform:uppercase;color:var(--sand);opacity:.8;font-weight:600;}
@media(max-width:900px){
  .nav{padding:8px 16px;min-height:80px;}
  .logo{gap:12px;}
  .logo-name{font-size:20px;letter-spacing:1.5px;}
  .logo-sub{font-size:9px;letter-spacing:2px;}
}
@media(max-width:520px){
  .logo-name{font-size:17px;}
  .logo-sub{font-size:8px;letter-spacing:1.5px;}
}
.nav-tabs{display:flex;gap:4px;}
.nav-tab{background:transparent;border:1px solid transparent;color:var(--sand);padding:8px 18px;font-family:'Lato',sans-serif;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;border-radius:3px;transition:all .2s;}
.nav-tab:hover{border-color:var(--dune);color:var(--dust);}
.nav-tab.active{background:var(--savanna);border-color:var(--savanna);color:var(--soil);}
.nav-admin-btn{background:transparent;border:1px solid var(--clay);color:var(--sand);padding:8px 16px;font-family:'Lato',sans-serif;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;border-radius:3px;transition:all .2s;position:relative;}
.nav-admin-btn:hover{border-color:var(--sand);}
.nav-admin-btn.locked{color:var(--horizon);border-color:var(--dune);}
.notif-dot{position:absolute;top:6px;right:6px;width:8px;height:8px;background:#ef4444;border-radius:50%;border:2px solid var(--soil);}

/* CONTACT STRIP */
.contact-strip{background:var(--clay);border-bottom:1px solid var(--dune);padding:7px 32px;display:flex;align-items:center;justify-content:flex-end;gap:28px;flex-wrap:wrap;}
.contact-strip a{color:var(--dust);text-decoration:none;font-size:12px;font-weight:700;display:flex;align-items:center;gap:6px;transition:color .2s;}
.contact-strip a:hover{color:var(--horizon);}

/* HERO */
.hero{background:linear-gradient(135deg,var(--soil) 0%,var(--earth) 40%,#2a1a08 100%);padding:64px 32px 56px;text-align:center;position:relative;overflow:hidden;}
.hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 80% 50% at 50% 110%,rgba(212,118,10,.18) 0%,transparent 70%);pointer-events:none;}
.hero-flag{display:inline-flex;align-items:center;gap:8px;background:rgba(212,118,10,.15);border:1px solid var(--savanna);color:var(--horizon);padding:5px 16px;border-radius:2px;font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;margin-bottom:20px;}
.hero h1{font-family:'Oswald',sans-serif;font-size:clamp(32px,6vw,66px);font-weight:700;letter-spacing:3px;color:var(--ivory);line-height:1;margin-bottom:8px;}
.hero h1 span{color:var(--horizon);display:block;}
.hero-sub{font-size:15px;color:var(--sand);font-weight:300;max-width:560px;margin:14px auto 32px;line-height:1.7;}
.hero-types{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;margin-bottom:32px;}
.hero-type-pill{display:flex;align-items:center;gap:10px;border:1px solid var(--clay);border-radius:40px;padding:10px 22px;cursor:pointer;transition:all .25s;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;background:rgba(0,0,0,.2);}
.hero-type-pill.hire{color:var(--horizon);}
.hero-type-pill.hire:hover,.hero-type-pill.hire.sel{background:var(--savanna);border-color:var(--savanna);color:var(--soil);}
.hero-type-pill.sale{color:var(--teal-light);}
.hero-type-pill.sale:hover,.hero-type-pill.sale.sel{background:var(--teal-light);border-color:var(--teal-light);color:#fff;}
.hero-actions{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;}
.btn-primary{background:var(--savanna);color:var(--soil);border:none;padding:13px 28px;font-family:'Lato',sans-serif;font-size:13px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;border-radius:3px;transition:all .2s;display:flex;align-items:center;gap:8px;}
.btn-primary:hover{background:var(--horizon);transform:translateY(-2px);}
.btn-sale{background:var(--teal-light);color:#fff;border:none;padding:13px 28px;font-family:'Lato',sans-serif;font-size:13px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;border-radius:3px;transition:all .2s;display:flex;align-items:center;gap:8px;}
.btn-sale:hover{background:var(--teal);}
.btn-outline{background:transparent;color:var(--sand);border:1px solid var(--clay);padding:13px 26px;font-family:'Lato',sans-serif;font-size:13px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;border-radius:3px;transition:all .2s;}
.btn-outline:hover{border-color:var(--sand);color:var(--dust);}
.hero-contact-row{display:flex;gap:22px;justify-content:center;flex-wrap:wrap;margin-top:16px;}
.hero-contact-row a{color:var(--sand);font-size:13px;text-decoration:none;opacity:.85;}
.hero-contact-row a:hover{opacity:1;color:var(--horizon);}
.hero-stats{display:flex;justify-content:center;gap:44px;margin-top:44px;padding-top:32px;border-top:1px solid var(--clay);flex-wrap:wrap;}
.stat{text-align:center;}
.stat-n{font-family:'Oswald',sans-serif;font-size:36px;color:var(--horizon);letter-spacing:1px;line-height:1;}
.stat-n.tc{color:var(--teal-light);}
.stat-l{font-size:10px;color:var(--sand);letter-spacing:2px;text-transform:uppercase;margin-top:4px;}

/* SEARCH */
.search-wrap{background:var(--earth);border-bottom:1px solid var(--clay);padding:0 32px;}
.search-bar{display:grid;grid-template-columns:2fr 1.2fr 1.2fr 1fr auto;max-width:1280px;margin:0 auto;}
.sf{padding:0 18px;border-right:1px solid var(--clay);display:flex;flex-direction:column;justify-content:center;min-height:64px;}
.sf label{font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--horizon);margin-bottom:3px;}
.sf input,.sf select{background:none;border:none;outline:none;color:var(--dust);font-family:'Lato',sans-serif;font-size:14px;width:100%;}
.sf select option{background:var(--earth);}
.sf input::placeholder{color:var(--sand);opacity:.6;}
.search-go{background:var(--savanna);border:none;padding:0 26px;color:var(--soil);font-family:'Lato',sans-serif;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;transition:background .2s;}
.search-go:hover{background:var(--horizon);}

/* TYPE TABS */
.type-tabs-wrap{background:var(--soil);border-bottom:1px solid var(--clay);padding:0 32px;}
.type-tabs{display:flex;max-width:1280px;margin:0 auto;}
.type-tab{padding:13px 26px;font-family:'Oswald',sans-serif;font-size:15px;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;border:none;background:transparent;color:var(--bark);border-bottom:3px solid transparent;transition:all .2s;display:flex;align-items:center;gap:8px;}
.type-tab:hover{color:var(--sand);}
.type-tab.hire.active{color:var(--horizon);border-bottom-color:var(--savanna);}
.type-tab.sale.active{color:var(--teal-light);border-bottom-color:var(--teal-light);}
.type-count{font-size:11px;background:rgba(255,255,255,.1);padding:2px 7px;border-radius:10px;}

/* MAIN */
.main{flex:1;max-width:1280px;margin:0 auto;padding:36px 32px;width:100%;}
.section-head{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:26px;}
.section-title{font-family:'Oswald',sans-serif;font-size:28px;letter-spacing:2px;color:var(--ivory);}
.section-title span{color:var(--horizon);}
.section-title span.sc{color:var(--teal-light);}
.count-badge{font-size:12px;color:var(--sand);border:1px solid var(--clay);padding:4px 12px;border-radius:2px;}
.filters{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:22px;}
.filt-btn{background:transparent;border:1px solid var(--clay);color:var(--sand);padding:5px 13px;font-family:'Lato',sans-serif;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;border-radius:2px;transition:all .2s;}
.filt-btn:hover{border-color:var(--savanna);}
.filt-btn.active{background:var(--savanna);border-color:var(--savanna);color:var(--soil);}
.filt-btn.sactive{background:var(--teal-light);border-color:var(--teal-light);color:#fff;}

/* LISTING CARDS */
.listing-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:22px;}
.listing-card{background:var(--earth);border:1px solid var(--clay);border-radius:4px;overflow:hidden;transition:all .3s;cursor:pointer;}
.listing-card:hover{transform:translateY(-4px);box-shadow:0 16px 48px rgba(0,0,0,.5);}
.listing-card.tier-premium{border-color:rgba(34,160,144,.4);}
.listing-card.tier-premium:hover{border-color:var(--teal-light);box-shadow:0 16px 48px rgba(34,160,144,.2);}
.listing-card.tier-featured{border-color:rgba(232,146,12,.35);}
.listing-card.tier-featured:hover{border-color:var(--horizon);}
.listing-card.tier-free:hover{border-color:var(--sand);}
.card-img{height:198px;background:var(--clay);display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;}
.card-img img{width:100%;height:100%;object-fit:cover;transition:transform .4s;}
.listing-card:hover .card-img img{transform:scale(1.05);}
.card-ph{display:flex;flex-direction:column;align-items:center;gap:8px;color:var(--bark);}
.card-ph span{font-size:46px;}
.card-ph p{font-size:11px;letter-spacing:1px;text-transform:uppercase;}
.type-rib{position:absolute;top:0;left:0;right:0;padding:5px 12px;font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;z-index:1;display:flex;justify-content:space-between;align-items:center;}
.type-rib.hire{background:rgba(212,118,10,.88);color:var(--soil);}
.type-rib.sale{background:rgba(34,160,144,.88);color:#fff;}
.rib-right{display:flex;align-items:center;gap:5px;}
.rib-badge{padding:2px 8px;border-radius:2px;font-size:9px;font-weight:700;}
.tier-badge-premium{background:rgba(34,160,144,.9);color:#fff;}
.tier-badge-featured{background:rgba(232,146,12,.9);color:var(--soil);}
.tier-badge-free{background:rgba(0,0,0,.3);color:var(--dust);}
.card-body{padding:17px 19px 19px;}
.card-cat{font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--horizon);margin-bottom:4px;}
.card-cat.sc{color:var(--teal-light);}
.card-name{font-family:'Oswald',sans-serif;font-size:17px;color:var(--ivory);letter-spacing:.5px;margin-bottom:5px;line-height:1.2;}
.card-meta{font-size:11px;color:var(--bark);margin-bottom:5px;display:flex;gap:10px;flex-wrap:wrap;}
.card-rating{display:flex;align-items:center;gap:5px;margin-bottom:7px;}
.stars-display{color:var(--gold);font-size:13px;letter-spacing:1px;}
.rating-num{font-size:11px;color:var(--sand);}
.card-loc{font-size:12px;color:var(--sand);margin-bottom:9px;}
.card-desc{font-size:12px;color:var(--sand);font-weight:300;line-height:1.5;margin-bottom:13px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
.card-foot{display:flex;align-items:center;justify-content:space-between;padding-top:13px;border-top:1px solid var(--clay);}
.price-amt{font-family:'Oswald',sans-serif;font-size:21px;color:var(--horizon);letter-spacing:1px;line-height:1;}
.price-amt.sc{color:var(--teal-light);}
.price-unit{font-size:10px;color:var(--sand);text-transform:uppercase;letter-spacing:1px;}
.btn-enq{background:transparent;border:1px solid var(--savanna);color:var(--savanna);padding:7px 15px;font-family:'Lato',sans-serif;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;border-radius:2px;transition:all .2s;white-space:nowrap;}
.btn-enq:hover{background:var(--savanna);color:var(--soil);}
.btn-enq.sc{border-color:var(--teal-light);color:var(--teal-light);}
.btn-enq.sc:hover{background:var(--teal-light);color:#fff;}

/* STAR RATING INPUT */
.star-input{display:flex;gap:4px;margin:8px 0;}
.star-btn{background:none;border:none;font-size:24px;cursor:pointer;color:var(--clay);transition:color .15s;padding:2px;}
.star-btn:hover,.star-btn.active{color:var(--gold);}

/* INTEREST FORM */
.interest-form{background:var(--soil);border:1px solid var(--clay);border-radius:4px;padding:20px;margin-top:16px;}
.interest-form-title{font-family:'Oswald',sans-serif;font-size:16px;letter-spacing:1px;color:var(--ivory);margin-bottom:14px;}
.if-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;}
.if-full{grid-column:1/-1;}
.fg{display:flex;flex-direction:column;}
.fg label{font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--horizon);margin-bottom:6px;}
.fg label.sl{color:var(--teal-light);}
.fg input,.fg select,.fg textarea{background:var(--earth);border:1px solid var(--clay);border-radius:2px;padding:10px 13px;color:var(--dust);font-family:'Lato',sans-serif;font-size:13px;outline:none;transition:border-color .2s;resize:vertical;}
.fg input:focus,.fg select:focus,.fg textarea:focus{border-color:var(--savanna);}
.fg input::placeholder{color:var(--sand);opacity:.5;}

/* DETAIL MODAL */
.modal-overlay{position:fixed;inset:0;z-index:300;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);padding:20px;}
.modal{background:var(--earth);border:1px solid var(--clay);border-radius:6px;padding:36px;width:min(760px,100%);max-height:90vh;overflow-y:auto;animation:slideUp .25s ease;position:relative;}
.modal-close{position:absolute;top:16px;right:16px;background:none;border:none;color:var(--sand);font-size:22px;cursor:pointer;width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:2px;transition:all .2s;}
.modal-close:hover{background:var(--clay);}
.modal-type-tag{display:inline-flex;align-items:center;gap:6px;padding:4px 13px;border-radius:2px;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;}
.modal-type-tag.hire{background:rgba(212,118,10,.2);color:var(--horizon);border:1px solid var(--savanna);}
.modal-type-tag.sale{background:rgba(34,160,144,.15);color:var(--teal-light);border:1px solid var(--teal-light);}
.modal-tier-badge{display:inline-flex;align-items:center;gap:6px;padding:4px 13px;border-radius:2px;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;margin-left:8px;}
.modal-tier-badge.premium{background:rgba(34,160,144,.15);color:var(--teal-light);border:1px solid var(--teal-light);}
.modal-tier-badge.featured{background:rgba(232,146,12,.15);color:var(--horizon);border:1px solid var(--savanna);}
.modal-img-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:18px;}
.modal-img-grid img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:3px;border:1px solid var(--clay);cursor:zoom-in;}
.modal h2{font-family:'Oswald',sans-serif;font-size:26px;letter-spacing:1px;color:var(--ivory);margin-bottom:6px;}
.modal-cat{font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--horizon);margin-bottom:10px;}
.modal-cat.sc{color:var(--teal-light);}
.modal-rating-row{display:flex;align-items:center;gap:12px;margin-bottom:14px;padding:12px 16px;background:var(--soil);border-radius:3px;border:1px solid var(--clay);}
.modal-rating-row .stars-display{font-size:18px;}
.modal-info-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;background:var(--soil);padding:15px;border-radius:3px;margin:13px 0;border:1px solid var(--clay);}
.ii label{font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--horizon);display:block;margin-bottom:3px;}
.ii label.sc{color:var(--teal-light);}
.ii p{font-size:13px;color:var(--dust);}
.modal-price{font-family:'Oswald',sans-serif;font-size:38px;color:var(--horizon);letter-spacing:1px;margin:10px 0 2px;}
.modal-price.sc{color:var(--teal-light);}
.modal-price-unit{font-size:11px;color:var(--sand);letter-spacing:1px;text-transform:uppercase;margin-bottom:18px;}
.nego-tag{display:inline-block;background:rgba(34,160,144,.15);color:var(--teal-light);border:1px solid var(--teal-light);padding:2px 10px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;border-radius:2px;margin-left:10px;vertical-align:middle;}
.modal-section-title{font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--horizon);margin:20px 0 10px;padding-top:16px;border-top:1px solid var(--clay);}
.modal-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:20px;}

/* CHAT WIDGET */
.chat-widget{position:fixed;bottom:24px;right:24px;z-index:400;}
.chat-bubble-btn{width:56px;height:56px;border-radius:50%;background:var(--savanna);border:none;color:var(--soil);font-size:22px;cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,.4);transition:all .2s;display:flex;align-items:center;justify-content:center;}
.chat-bubble-btn:hover{background:var(--horizon);transform:scale(1.08);}
.chat-unread{position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;width:20px;height:20px;border-radius:50%;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;border:2px solid var(--soil);}
.chat-panel{position:absolute;bottom:70px;right:0;width:340px;background:var(--earth);border:1px solid var(--clay);border-radius:8px;box-shadow:0 16px 48px rgba(0,0,0,.6);overflow:hidden;animation:slideUp .2s ease;}
.chat-header{background:var(--clay);padding:14px 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--dune);}
.chat-header-title{font-family:'Oswald',sans-serif;font-size:15px;letter-spacing:1px;color:var(--ivory);display:flex;align-items:center;gap:8px;}
.chat-online{width:8px;height:8px;background:#22c55e;border-radius:50%;}
.chat-close{background:none;border:none;color:var(--sand);font-size:18px;cursor:pointer;}
.chat-messages{height:280px;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;}
.chat-msg{max-width:85%;padding:9px 13px;border-radius:6px;font-size:13px;line-height:1.5;}
.chat-msg.me{background:var(--chat-me);color:var(--dust);align-self:flex-end;border-bottom-right-radius:2px;}
.chat-msg.admin{background:var(--chat-admin);color:var(--dust);align-self:flex-start;border-bottom-left-radius:2px;}
.chat-msg-meta{font-size:9px;opacity:.6;margin-top:4px;}
.chat-msg.me .chat-msg-meta{text-align:right;}
.chat-input-row{border-top:1px solid var(--clay);padding:12px;display:flex;gap:8px;}
.chat-input{flex:1;background:var(--soil);border:1px solid var(--clay);border-radius:20px;padding:8px 14px;color:var(--dust);font-family:'Lato',sans-serif;font-size:13px;outline:none;}
.chat-input:focus{border-color:var(--savanna);}
.chat-input::placeholder{color:var(--bark);}
.chat-send{background:var(--savanna);color:var(--soil);border:none;width:36px;height:36px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;}
.chat-send:hover{background:var(--horizon);}
.chat-name-form{padding:14px;border-top:1px solid var(--clay);}
.chat-name-form p{font-size:12px;color:var(--sand);margin-bottom:10px;}

/* PRICING */
.pricing-page{max-width:960px;margin:0 auto;padding:48px 32px;}
.pricing-title{font-family:'Oswald',sans-serif;font-size:36px;letter-spacing:2px;color:var(--ivory);text-align:center;margin-bottom:8px;}
.pricing-title span{color:var(--horizon);}
.pricing-sub{text-align:center;font-size:14px;color:var(--sand);font-weight:300;margin-bottom:40px;line-height:1.7;}
.pricing-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-bottom:40px;}
.tier-card{border-radius:6px;padding:28px 24px;position:relative;transition:transform .2s;cursor:pointer;}
.tier-card:hover{transform:translateY(-4px);}
.tier-card.free{background:rgba(196,169,125,.08);border:2px solid var(--clay);}
.tier-card.free.selected{border-color:var(--sand);}
.tier-card.featured{background:rgba(232,146,12,.08);border:2px solid var(--savanna);}
.tier-card.featured.selected{border-color:var(--horizon);box-shadow:0 0 0 3px rgba(232,146,12,.2);}
.tier-card.premium{background:rgba(34,160,144,.08);border:2px solid var(--teal-light);}
.tier-card.premium.selected{border-color:var(--teal-light);box-shadow:0 0 0 3px rgba(34,160,144,.2);}
.tier-popular{position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:var(--teal-light);color:#fff;padding:3px 16px;border-radius:10px;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;white-space:nowrap;}
.tier-name{font-family:'Oswald',sans-serif;font-size:24px;letter-spacing:1.5px;margin-bottom:4px;}
.tier-card.free .tier-name{color:var(--sand);}
.tier-card.featured .tier-name{color:var(--horizon);}
.tier-card.premium .tier-name{color:var(--teal-light);}
.tier-price{font-family:'Oswald',sans-serif;font-size:36px;margin:12px 0 4px;line-height:1;}
.tier-card.free .tier-price{color:var(--sand);}
.tier-card.featured .tier-price{color:var(--horizon);}
.tier-card.premium .tier-price{color:var(--teal-light);}
.tier-period{font-size:11px;color:var(--sand);letter-spacing:1px;text-transform:uppercase;margin-bottom:20px;}
.tier-perks{list-style:none;margin-bottom:24px;}
.tier-perks li{font-size:13px;color:var(--dust);padding:6px 0;border-bottom:1px solid rgba(255,255,255,.05);display:flex;align-items:center;gap:8px;font-weight:300;}
.tier-perks li::before{content:'✓';font-weight:700;font-size:11px;}
.tier-card.free .tier-perks li::before{color:var(--sand);}
.tier-card.featured .tier-perks li::before{color:var(--horizon);}
.tier-card.premium .tier-perks li::before{color:var(--teal-light);}
.tier-select-btn{width:100%;padding:12px;font-family:'Lato',sans-serif;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;border-radius:3px;border:none;transition:all .2s;}
.tier-card.free .tier-select-btn{background:transparent;border:1px solid var(--clay);color:var(--sand);}
.tier-card.free .tier-select-btn:hover{background:var(--sand);color:var(--soil);}
.tier-card.featured .tier-select-btn{background:var(--savanna);color:var(--soil);}
.tier-card.featured .tier-select-btn:hover{background:var(--horizon);}
.tier-card.premium .tier-select-btn{background:var(--teal-light);color:#fff;}
.tier-card.premium .tier-select-btn:hover{background:var(--teal);}

/* PAYMENT BOX */
.pay-box{background:var(--earth);border:1px solid var(--dune);border-radius:6px;padding:28px;margin-bottom:28px;}
.pay-box-title{font-family:'Oswald',sans-serif;font-size:20px;letter-spacing:1.5px;color:var(--ivory);margin-bottom:6px;display:flex;align-items:center;gap:10px;}
.pay-box-title span{color:var(--horizon);}
.pay-box-sub{font-size:13px;color:var(--sand);margin-bottom:20px;font-weight:300;line-height:1.6;}
.bank-details{background:var(--soil);border:1px solid var(--clay);border-radius:4px;padding:18px;margin-bottom:16px;}
.bank-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(61,41,16,.5);}
.bank-row:last-child{border-bottom:none;}
.bank-label{font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--dune);}
.bank-value{font-size:14px;color:var(--dust);font-weight:700;font-family:'Oswald',sans-serif;letter-spacing:1px;}
.bank-value.accent{color:var(--horizon);font-size:18px;}
.pay-note{background:rgba(232,146,12,.08);border:1px solid var(--dune);border-radius:3px;padding:12px 16px;font-size:12px;color:var(--sand);line-height:1.6;}
.pay-note strong{color:var(--horizon);}

/* SUBMIT FORM */
.submit-page{max-width:800px;margin:0 auto;padding:40px 32px;}
.form-card{background:var(--earth);border:1px solid var(--clay);border-radius:4px;padding:40px;}
.form-title{font-family:'Oswald',sans-serif;font-size:27px;letter-spacing:2px;color:var(--ivory);margin-bottom:6px;}
.form-subtitle{font-size:14px;color:var(--sand);margin-bottom:24px;font-weight:300;}
.selected-tier-banner{display:flex;align-items:center;gap:14px;padding:14px 18px;border-radius:4px;margin-bottom:24px;}
.selected-tier-banner.free{background:rgba(196,169,125,.1);border:1px solid var(--clay);}
.selected-tier-banner.featured{background:rgba(232,146,12,.1);border:1px solid var(--savanna);}
.selected-tier-banner.premium{background:rgba(34,160,144,.1);border:1px solid var(--teal-light);}
.stb-icon{font-size:24px;}
.stb-label{font-family:'Oswald',sans-serif;font-size:16px;letter-spacing:1px;}
.stb-label.free{color:var(--sand);}
.stb-label.featured{color:var(--horizon);}
.stb-label.premium{color:var(--teal-light);}
.stb-desc{font-size:12px;color:var(--sand);font-weight:300;}
.stb-change{margin-left:auto;background:transparent;border:1px solid var(--clay);color:var(--sand);padding:6px 12px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;cursor:pointer;border-radius:2px;}
.type-selector{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:26px;}
.type-opt{border:2px solid var(--clay);border-radius:4px;padding:18px 16px;cursor:pointer;transition:all .2s;text-align:center;background:rgba(0,0,0,.2);}
.type-opt.hs{border-color:var(--savanna);background:rgba(212,118,10,.1);}
.type-opt.ss{border-color:var(--teal-light);background:rgba(34,160,144,.1);}
.type-opt-icon{font-size:28px;margin-bottom:8px;}
.type-opt-title{font-family:'Oswald',sans-serif;font-size:17px;letter-spacing:1px;margin-bottom:4px;color:var(--sand);}
.type-opt.hs .type-opt-title{color:var(--horizon);}
.type-opt.ss .type-opt-title{color:var(--teal-light);}
.type-opt-desc{font-size:12px;color:var(--sand);opacity:.7;}
.form-row{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;}
.form-full{grid-column:1/-1;}
.chk-row{display:flex;align-items:center;gap:10px;margin-top:8px;}
.chk-row input[type=checkbox]{width:16px;height:16px;accent-color:var(--teal-light);cursor:pointer;}
.chk-row label{font-size:13px;color:var(--sand);cursor:pointer;font-weight:400;text-transform:none;letter-spacing:0;}
.submit-notice{background:rgba(212,118,10,.08);border:1px solid var(--dune);border-radius:3px;padding:12px 16px;margin-bottom:22px;font-size:13px;color:var(--sand);line-height:1.5;}
.photo-limit-note{background:rgba(0,0,0,.2);border:1px solid var(--clay);border-radius:3px;padding:10px 14px;font-size:12px;color:var(--sand);margin-bottom:10px;display:flex;align-items:center;gap:8px;}
.img-upload-zone{border:2px dashed var(--clay);border-radius:4px;padding:26px;text-align:center;cursor:pointer;transition:all .2s;margin-bottom:12px;}
.img-upload-zone:hover,.img-upload-zone.drag{border-color:var(--savanna);background:var(--smoke);}
.up-icon{font-size:30px;margin-bottom:8px;}
.img-upload-zone p{font-size:13px;color:var(--sand);}
.img-upload-zone small{font-size:11px;color:var(--bark);margin-top:4px;display:block;}
.img-previews{display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:10px;margin-top:10px;}
.img-preview{aspect-ratio:1;border-radius:3px;overflow:hidden;position:relative;border:1px solid var(--clay);}
.img-preview img{width:100%;height:100%;object-fit:cover;}
.img-del{position:absolute;top:3px;right:3px;background:rgba(0,0,0,.7);color:#fff;border:none;width:20px;height:20px;border-radius:50%;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;}

/* ADMIN */
.admin-page{max-width:1280px;margin:0 auto;padding:36px 32px;}
.admin-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:26px;flex-wrap:wrap;gap:16px;}
.admin-title{font-family:'Oswald',sans-serif;font-size:28px;letter-spacing:2px;color:var(--ivory);}
.admin-title span{color:var(--horizon);}
.admin-tabs{display:flex;gap:8px;flex-wrap:wrap;}
.admin-tab{background:transparent;border:1px solid var(--clay);color:var(--sand);padding:7px 15px;font-family:'Lato',sans-serif;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;border-radius:3px;transition:all .2s;display:flex;align-items:center;gap:6px;}
.admin-tab:hover{border-color:var(--sand);}
.admin-tab.active{background:var(--savanna);border-color:var(--savanna);color:var(--soil);}
.bc{background:rgba(0,0,0,.2);padding:1px 6px;border-radius:10px;font-size:10px;}
.admin-table{width:100%;border-collapse:collapse;margin-top:16px;}
.admin-table th{text-align:left;padding:10px 13px;font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--horizon);border-bottom:1px solid var(--clay);background:var(--earth);}
.admin-table td{padding:13px 13px;font-size:13px;color:var(--dust);border-bottom:1px solid rgba(61,41,16,.5);vertical-align:top;}
.admin-table tr:hover td{background:var(--smoke);}
.lt-pill{display:inline-block;padding:2px 9px;border-radius:2px;font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:3px;}
.lt-hire{background:rgba(212,118,10,.2);color:var(--horizon);}
.lt-sale{background:rgba(34,160,144,.15);color:var(--teal-light);}
.tier-admin-pill{display:inline-block;padding:2px 9px;border-radius:2px;font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;}
.tp-free{background:rgba(196,169,125,.15);color:var(--sand);}
.tp-featured{background:rgba(232,146,12,.2);color:var(--horizon);}
.tp-premium{background:rgba(34,160,144,.15);color:var(--teal-light);}
.status-pill{padding:3px 10px;border-radius:2px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;}
.pill-pending{background:rgba(184,92,32,.2);color:var(--horizon);}
.pill-approved{background:rgba(46,125,50,.2);color:#81c784;}
.pill-rejected{background:rgba(183,28,28,.2);color:#ef9a9a;}
.action-btns{display:flex;gap:6px;flex-wrap:wrap;}
.btn-approve{background:var(--green-ok);color:#fff;border:none;padding:5px 11px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;cursor:pointer;border-radius:2px;}
.btn-reject{background:transparent;color:#ef9a9a;border:1px solid var(--red-no);padding:5px 11px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;cursor:pointer;border-radius:2px;}
.btn-reject:hover{background:var(--red-no);color:#fff;}
.btn-muted{background:transparent;color:var(--bark);border:1px solid var(--clay);padding:5px 10px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;cursor:pointer;border-radius:2px;}
.btn-muted:hover{background:var(--clay);color:var(--dust);}

/* LEADS / INTERESTS */
.lead-card{background:var(--earth);border:1px solid var(--clay);border-radius:4px;padding:18px;margin-bottom:14px;}
.lead-card.unread{border-color:var(--savanna);}
.lead-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px;}
.lead-name{font-weight:700;font-size:15px;color:var(--ivory);}
.lead-time{font-size:11px;color:var(--bark);}
.lead-contact{background:var(--soil);padding:10px 14px;border-radius:3px;border:1px solid var(--clay);margin-bottom:10px;}
.lead-contact p{font-size:12px;color:var(--dust);margin-bottom:4px;}
.lead-contact a{color:var(--horizon);text-decoration:none;font-weight:700;font-size:12px;}
.lead-listing{font-size:12px;color:var(--sand);margin-bottom:10px;}
.lead-msg{font-size:13px;color:var(--dust);font-style:italic;border-left:3px solid var(--clay);padding-left:12px;margin-bottom:12px;line-height:1.6;}
.lead-actions{display:flex;gap:8px;flex-wrap:wrap;}
.lead-rating{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--gold);}

/* ADMIN CHAT PANEL */
.admin-chat-panel{background:var(--earth);border:1px solid var(--clay);border-radius:4px;overflow:hidden;}
.admin-chat-list{height:200px;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:8px;}
.admin-chat-msg{font-size:13px;line-height:1.5;padding:8px 12px;border-radius:5px;}
.admin-chat-msg.from-user{background:rgba(212,118,10,.1);border:1px solid rgba(212,118,10,.2);}
.admin-chat-msg.from-admin{background:rgba(34,160,144,.1);border:1px solid rgba(34,160,144,.15);}
.acm-meta{font-size:10px;opacity:.6;margin-bottom:3px;}
.acm-meta.admin{color:var(--teal-light);}
.admin-chat-input-row{border-top:1px solid var(--clay);padding:12px;display:flex;gap:8px;}
.admin-chat-input{flex:1;background:var(--soil);border:1px solid var(--clay);border-radius:3px;padding:9px 12px;color:var(--dust);font-family:'Lato',sans-serif;font-size:13px;outline:none;}
.admin-chat-input:focus{border-color:var(--teal-light);}

/* LOGIN */
.login-overlay{position:fixed;inset:0;z-index:500;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);}
.login-box{background:var(--earth);border:1px solid var(--dune);border-radius:6px;padding:48px;width:min(420px,90vw);animation:slideUp .3s ease;}
.login-box h3{font-family:'Oswald',sans-serif;font-size:28px;letter-spacing:2px;color:var(--ivory);margin-bottom:8px;}
.login-box p{font-size:13px;color:var(--sand);margin-bottom:22px;}
.login-err{background:rgba(183,28,28,.15);border:1px solid var(--red-no);color:#ef9a9a;padding:10px 14px;border-radius:3px;font-size:13px;margin-bottom:14px;}
.toast{position:fixed;bottom:32px;right:32px;z-index:999;background:var(--savanna);color:var(--soil);padding:13px 22px;border-radius:3px;font-size:13px;font-weight:700;box-shadow:0 8px 24px rgba(0,0,0,.4);animation:toastIn .3s ease;}
.toast.st{background:var(--teal-light);color:#fff;}
.footer{background:var(--soil);border-top:1px solid var(--clay);padding:32px;text-align:center;}
.footer p{font-size:12px;color:var(--bark);letter-spacing:1px;}
.footer span{color:var(--horizon);}
.empty{text-align:center;padding:70px 20px;color:var(--bark);}
.empty-icon{font-size:50px;margin-bottom:14px;}
.empty h3{font-family:'Oswald',sans-serif;font-size:22px;color:var(--sand);margin-bottom:8px;}
.empty p{font-size:14px;}

/* ── SOLD BADGE ── */
.sold-overlay{position:absolute;inset:0;background:rgba(20,13,4,.75);display:flex;align-items:center;justify-content:center;z-index:2;}
.sold-stamp{border:4px solid #ef4444;border-radius:4px;padding:8px 20px;transform:rotate(-15deg);color:#ef4444;font-family:'Oswald',sans-serif;font-size:28px;letter-spacing:4px;font-weight:700;text-shadow:0 0 12px rgba(239,68,68,.5);box-shadow:0 0 12px rgba(239,68,68,.3);}
.sold-tag{display:inline-flex;align-items:center;gap:6px;background:rgba(239,68,68,.15);border:1px solid #ef4444;color:#ef9a9a;padding:4px 13px;border-radius:2px;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;}

/* ── AVAILABILITY CALENDAR ── */
.avail-section{margin-top:16px;}
.avail-title{font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--horizon);margin-bottom:12px;padding-top:16px;border-top:1px solid var(--clay);}
.calendar-wrap{background:var(--soil);border:1px solid var(--clay);border-radius:4px;padding:16px;margin-bottom:16px;}
.cal-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;}
.cal-nav{background:transparent;border:1px solid var(--clay);color:var(--sand);width:30px;height:30px;border-radius:3px;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;transition:all .2s;}
.cal-nav:hover{border-color:var(--savanna);color:var(--horizon);}
.cal-month{font-family:'Oswald',sans-serif;font-size:16px;color:var(--ivory);letter-spacing:1px;}
.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;}
.cal-day-name{text-align:center;font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--bark);padding:4px 0;}
.cal-day{text-align:center;padding:5px 2px;border-radius:3px;font-size:12px;cursor:pointer;transition:all .15s;border:1px solid transparent;position:relative;min-height:28px;display:flex;align-items:center;justify-content:center;}
.cal-day.empty{cursor:default;}
.cal-day.past{color:var(--clay);cursor:not-allowed;}
.cal-day.available{color:var(--dust);cursor:pointer;}
.cal-day.available:hover{background:rgba(212,118,10,.2);border-color:var(--savanna);}
.cal-day.booked{background:rgba(239,68,68,.15);color:#ef9a9a;cursor:not-allowed;text-decoration:line-through;}
.cal-day.selected-start,.cal-day.selected-end{background:var(--savanna);color:var(--soil);font-weight:700;border-color:var(--horizon);}
.cal-day.selected-range{background:rgba(212,118,10,.2);border-color:rgba(212,118,10,.3);color:var(--dust);}
.cal-day.today{border-color:var(--dune);}
.cal-legend{display:flex;gap:14px;flex-wrap:wrap;margin-top:10px;}
.cal-legend-item{display:flex;align-items:center;gap:5px;font-size:10px;color:var(--sand);}
.cal-legend-dot{width:10px;height:10px;border-radius:2px;}

/* ── BOOKING FORM ── */
.booking-form{background:var(--soil);border:1px solid var(--clay);border-radius:4px;padding:18px;margin-top:12px;}
.booking-form-title{font-family:'Oswald',sans-serif;font-size:16px;letter-spacing:1px;color:var(--ivory);margin-bottom:14px;display:flex;align-items:center;gap:8px;}
.booking-summary{background:var(--earth);border:1px solid var(--savanna);border-radius:3px;padding:14px 16px;margin-bottom:14px;}
.bs-row{display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(61,41,16,.5);}
.bs-row:last-child{border-bottom:none;padding-top:8px;}
.bs-label{font-size:11px;color:var(--sand);}
.bs-value{font-size:13px;color:var(--dust);font-weight:700;}
.bs-total{font-family:'Oswald',sans-serif;font-size:22px;color:var(--horizon);}
.booking-confirmed{background:rgba(46,125,50,.12);border:1px solid var(--green-ok);border-radius:4px;padding:20px;text-align:center;}

/* ── ADMIN BOOKINGS ── */
.booking-card{background:var(--earth);border:1px solid var(--clay);border-radius:4px;padding:16px;margin-bottom:12px;}
.booking-card.pending-b{border-left:4px solid var(--horizon);}
.booking-card.confirmed-b{border-left:4px solid var(--green-ok);}
.booking-card.cancelled-b{border-left:4px solid var(--red-no);}
.booking-status{display:inline-block;padding:3px 10px;border-radius:2px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;}
.bs-pending{background:rgba(232,146,12,.2);color:var(--horizon);}
.bs-confirmed{background:rgba(46,125,50,.2);color:#81c784;}
.bs-cancelled{background:rgba(183,28,28,.2);color:#ef9a9a;}
.bs-sold{background:rgba(239,68,68,.15);color:#ef4444;border:1px solid #ef4444;}

/* ── ADVERTISING ── */
.ad-hero-banner{position:relative;overflow:hidden;width:100%;cursor:pointer;transition:opacity .2s;min-height:60px;}
.ad-hero-banner:hover{opacity:.92;}
.ad-hero-inner{display:flex;align-items:center;justify-content:space-between;padding:14px 40px;min-height:72px;gap:24px;}
.ad-hero-brand{font-family:'Oswald',sans-serif;font-size:20px;font-weight:700;letter-spacing:1.5px;}
.ad-hero-tagline{font-size:14px;opacity:.85;flex:1;text-align:center;font-weight:300;}
.ad-hero-cta{white-space:nowrap;padding:8px 20px;border-radius:3px;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;border:1px solid currentColor;cursor:pointer;background:transparent;transition:all .2s;}
.ad-hero-cta:hover{opacity:.8;}
.ad-hero-img{width:100%;height:80px;object-fit:cover;}
.ad-label{font-size:9px;letter-spacing:1.5px;text-transform:uppercase;opacity:.5;position:absolute;top:4px;right:8px;}

.ad-inline-card{border-radius:4px;overflow:hidden;cursor:pointer;transition:transform .2s;position:relative;border:1px solid rgba(255,255,255,.08);}
.ad-inline-card:hover{transform:translateY(-3px);}
.ad-inline-inner{padding:22px 18px;min-height:160px;display:flex;flex-direction:column;justify-content:center;}
.ad-inline-ad-tag{font-size:9px;letter-spacing:2px;text-transform:uppercase;opacity:.5;margin-bottom:10px;}
.ad-inline-brand{font-family:'Oswald',sans-serif;font-size:17px;font-weight:700;letter-spacing:1px;margin-bottom:6px;}
.ad-inline-tagline{font-size:12px;opacity:.8;line-height:1.5;font-weight:300;margin-bottom:14px;}
.ad-inline-cta{display:inline-block;padding:7px 16px;border-radius:2px;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;border:1px solid currentColor;width:fit-content;}
.ad-inline-img{width:100%;height:100px;object-fit:cover;}

.ad-footer-strip{width:100%;cursor:pointer;transition:opacity .2s;}
.ad-footer-strip:hover{opacity:.9;}
.ad-footer-inner{display:flex;align-items:center;justify-content:center;gap:24px;padding:16px 40px;flex-wrap:wrap;}
.ad-footer-brand{font-family:'Oswald',sans-serif;font-size:18px;font-weight:700;letter-spacing:2px;}
.ad-footer-tagline{font-size:13px;opacity:.8;}
.ad-footer-label{font-size:9px;letter-spacing:1.5px;text-transform:uppercase;opacity:.4;position:absolute;top:4px;right:12px;}
.ad-footer-img{width:100%;height:60px;object-fit:cover;}

.ad-modal-sponsor{padding:14px 18px;border-radius:4px;cursor:pointer;transition:opacity .2s;margin-top:16px;position:relative;}
.ad-modal-sponsor:hover{opacity:.9;}
.ad-modal-sponsor-label{font-size:9px;letter-spacing:2px;text-transform:uppercase;opacity:.5;margin-bottom:6px;}
.ad-modal-sponsor-inner{display:flex;align-items:center;gap:14px;}
.ad-modal-sponsor-brand{font-family:'Oswald',sans-serif;font-size:15px;font-weight:700;letter-spacing:1px;}
.ad-modal-sponsor-tagline{font-size:12px;opacity:.8;font-weight:300;}
.ad-modal-sponsor-img{height:40px;object-fit:contain;border-radius:3px;}

/* Ad Admin */
.ad-admin-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:20px;margin-top:20px;}
.ad-card{background:var(--earth);border:1px solid var(--clay);border-radius:6px;overflow:hidden;}
.ad-card.active-ad{border-color:var(--green-ok);}
.ad-card.inactive-ad{border-color:var(--clay);opacity:.7;}
.ad-card.expiring{border-color:#f59e0b;}
.ad-card-preview{padding:16px;min-height:80px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:6px;position:relative;}
.ad-card-body{padding:16px;border-top:1px solid var(--clay);}
.ad-card-name{font-family:'Oswald',sans-serif;font-size:16px;color:var(--ivory);letter-spacing:.5px;margin-bottom:4px;}
.ad-card-slot{font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;}
.ad-card-slot.hero_banner{color:#6db3e8;}
.ad-card-slot.inline_card{color:var(--horizon);}
.ad-card-slot.footer_strip{color:var(--sand);}
.ad-card-slot.modal_sponsor{color:var(--teal-light);}
.ad-card-dates{font-size:11px;color:var(--bark);margin-bottom:12px;}
.ad-status{display:inline-block;padding:2px 10px;border-radius:2px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;}
.ad-status.on{background:rgba(46,125,50,.2);color:#81c784;}
.ad-status.off{background:rgba(100,100,100,.2);color:var(--bark);}
.ad-status.exp{background:rgba(183,28,28,.2);color:#ef9a9a;}
.ad-form{background:var(--soil);border:1px solid var(--clay);border-radius:6px;padding:28px;margin-bottom:28px;}
.ad-form-title{font-family:'Oswald',sans-serif;font-size:22px;letter-spacing:1.5px;color:var(--ivory);margin-bottom:20px;}
.ad-slot-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:20px;}
.ad-slot-opt{border:2px solid var(--clay);border-radius:4px;padding:14px;cursor:pointer;transition:all .2s;}
.ad-slot-opt:hover{border-color:var(--dune);}
.ad-slot-opt.sel{border-color:var(--horizon);background:rgba(232,146,12,.08);}
.ad-slot-opt-name{font-family:'Oswald',sans-serif;font-size:15px;letter-spacing:.5px;color:var(--ivory);margin-bottom:3px;}
.ad-slot-opt-price{font-size:12px;color:var(--horizon);font-weight:700;margin-bottom:3px;}
.ad-slot-opt-desc{font-size:11px;color:var(--sand);line-height:1.4;}
.revenue-summary{background:var(--earth);border:1px solid var(--clay);border-radius:4px;padding:20px;margin-bottom:24px;display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:16px;}
.rev-item{text-align:center;}
.rev-num{font-family:'Oswald',sans-serif;font-size:28px;color:var(--horizon);letter-spacing:1px;}
.rev-num.green{color:#81c784;}
.rev-label{font-size:10px;color:var(--sand);letter-spacing:1.5px;text-transform:uppercase;margin-top:3px;}

/* ── HIRE AGREEMENT ── */
.agreement-wrap{background:var(--soil);border:2px solid var(--dune);border-radius:6px;overflow:hidden;margin-top:14px;}
.agreement-header{background:var(--clay);padding:16px 20px;border-bottom:1px solid var(--dune);text-align:center;}
.agreement-header h3{font-family:'Oswald',sans-serif;font-size:20px;letter-spacing:2px;color:var(--ivory);margin-bottom:2px;}
.agreement-header p{font-size:11px;color:var(--sand);letter-spacing:1px;}
.agreement-body{padding:0 20px 20px;max-height:380px;overflow-y:auto;font-size:12px;color:var(--dust);line-height:1.75;}
.agreement-body::-webkit-scrollbar{width:4px;}
.agreement-body::-webkit-scrollbar-track{background:var(--soil);}
.agreement-body::-webkit-scrollbar-thumb{background:var(--clay);border-radius:2px;}
.ag-section{margin-top:18px;}
.ag-section h4{font-family:'Oswald',sans-serif;font-size:13px;letter-spacing:1.5px;text-transform:uppercase;color:var(--horizon);margin-bottom:6px;border-bottom:1px solid var(--clay);padding-bottom:4px;}
.ag-section p,.ag-section li{color:var(--dust);font-size:12px;line-height:1.75;margin-bottom:4px;}
.ag-section ul,.ag-section ol{padding-left:18px;}
.ag-parties{background:var(--earth);border:1px solid var(--clay);border-radius:3px;padding:12px 16px;margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.ag-party-label{font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--dune);margin-bottom:3px;}
.ag-party-value{font-size:13px;color:var(--ivory);font-weight:700;}
.ag-party-sub{font-size:11px;color:var(--sand);}
.agreement-footer{padding:16px 20px;border-top:1px solid var(--clay);background:var(--earth);}
.agree-checkbox-row{display:flex;align-items:flex-start;gap:10px;margin-bottom:14px;cursor:pointer;}
.agree-checkbox-row input[type=checkbox]{width:18px;height:18px;flex-shrink:0;margin-top:2px;accent-color:var(--savanna);cursor:pointer;}
.agree-checkbox-row label{font-size:12px;color:var(--dust);cursor:pointer;line-height:1.6;}
.agree-checkbox-row label strong{color:var(--horizon);}
.sig-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;}
.sig-box{background:var(--soil);border:1px solid var(--clay);border-radius:3px;padding:10px 13px;}
.sig-label{font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--dune);margin-bottom:5px;}
.sig-input{background:none;border:none;outline:none;color:var(--ivory);font-family:'Lato',sans-serif;font-size:14px;font-style:italic;width:100%;border-bottom:1px solid var(--clay);padding-bottom:4px;}
.step-indicator{display:flex;gap:0;margin-bottom:20px;}
.step-ind{flex:1;padding:8px;text-align:center;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;border-bottom:2px solid var(--clay);color:var(--bark);transition:all .2s;}
.step-ind.active{border-bottom-color:var(--savanna);color:var(--horizon);}
.step-ind.done{border-bottom-color:var(--green-ok);color:#81c784;}

/* ── TRAFFIC BOOSTER ── */
.boost-panel{background:linear-gradient(135deg,rgba(34,160,144,.12) 0%,rgba(34,122,110,.08) 100%);border:1px solid var(--teal-light);border-radius:6px;padding:18px 20px;margin-top:16px;}
.boost-title{font-family:'Oswald',sans-serif;font-size:15px;letter-spacing:1.5px;color:var(--teal-light);margin-bottom:4px;display:flex;align-items:center;gap:8px;}
.boost-sub{font-size:12px;color:var(--sand);margin-bottom:14px;line-height:1.5;}
.share-btns{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;}
.share-btn{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:4px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;text-decoration:none;cursor:pointer;border:none;transition:all .2s;white-space:nowrap;}
.share-btn:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(0,0,0,.3);}
.share-fb{background:#1877f2;color:#fff;}
.share-wa{background:#25d366;color:#fff;}
.share-x{background:#000;color:#fff;}
.share-li{background:#0a66c2;color:#fff;}
.share-copy{background:var(--clay);color:var(--dust);}
.share-copy.copied{background:var(--green-ok);color:#fff;}
.boost-stats{display:flex;gap:16px;flex-wrap:wrap;padding-top:12px;border-top:1px solid rgba(34,160,144,.2);}
.boost-stat-n{font-family:'Oswald',sans-serif;font-size:20px;color:var(--teal-light);line-height:1;}
.boost-stat-l{font-size:9px;color:var(--bark);letter-spacing:1.5px;text-transform:uppercase;margin-top:2px;}
.boost-badge{background:rgba(34,160,144,.9);color:#fff;padding:3px 10px;border-radius:10px;font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;display:flex;align-items:center;gap:4px;cursor:pointer;transition:all .2s;}
.boost-badge:hover{background:var(--teal);}
.share-modal-overlay{position:fixed;inset:0;z-index:350;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);padding:20px;}
.share-modal{background:var(--earth);border:1px solid var(--teal-light);border-radius:8px;padding:28px;width:min(480px,100%);animation:slideUp .25s ease;position:relative;}
.share-modal-close{position:absolute;top:14px;right:14px;background:none;border:none;color:var(--sand);font-size:20px;cursor:pointer;}
.share-url-box{background:var(--soil);border:1px solid var(--clay);border-radius:3px;padding:10px 13px;display:flex;align-items:center;gap:8px;margin-bottom:16px;}
.share-url-text{flex:1;font-size:12px;color:var(--sand);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.share-url-copy{background:var(--savanna);color:var(--soil);border:none;padding:6px 14px;border-radius:2px;font-size:10px;font-weight:700;cursor:pointer;white-space:nowrap;}
.share-url-copy:hover{background:var(--horizon);}
.share-caption{background:var(--soil);border:1px solid var(--clay);border-radius:3px;padding:10px 13px;font-size:12px;color:var(--dust);line-height:1.6;margin-bottom:16px;white-space:pre-wrap;}

/* ── AD SUBMISSION PUBLIC FORM ── */
.advertise-page{max-width:860px;margin:0 auto;padding:48px 32px;}
.advertise-hero{background:linear-gradient(135deg,rgba(232,146,12,.12) 0%,rgba(34,160,144,.08) 100%);border:1px solid var(--dune);border-radius:8px;padding:36px;text-align:center;margin-bottom:36px;}
.advertise-hero h1{font-family:'Oswald',sans-serif;font-size:32px;letter-spacing:2px;color:var(--ivory);margin-bottom:8px;}
.advertise-hero h1 span{color:var(--horizon);}
.advertise-hero p{font-size:14px;color:var(--sand);font-weight:300;line-height:1.7;max-width:560px;margin:0 auto 24px;}
.slot-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px;margin-bottom:36px;}
.slot-pick-card{border:2px solid var(--clay);border-radius:6px;padding:16px;cursor:pointer;transition:all .2s;text-align:center;background:rgba(0,0,0,.2);}
.slot-pick-card:hover{border-color:var(--dune);transform:translateY(-2px);}
.slot-pick-card.sel{border-color:var(--horizon);background:rgba(232,146,12,.1);}
.slot-pick-icon{font-size:26px;margin-bottom:8px;}
.slot-pick-name{font-family:'Oswald',sans-serif;font-size:15px;color:var(--ivory);margin-bottom:3px;}
.slot-pick-price{font-size:13px;color:var(--horizon);font-weight:700;margin-bottom:3px;}
.slot-pick-desc{font-size:11px;color:var(--sand);line-height:1.4;}
.ad-sub-success{background:rgba(46,125,50,.12);border:2px solid var(--green-ok);border-radius:8px;padding:32px;text-align:center;}
/* pending pill */
.pill-pending-ad{background:rgba(184,92,32,.2);color:var(--horizon);padding:3px 10px;border-radius:2px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;}
.pill-approved-ad{background:rgba(46,125,50,.2);color:#81c784;padding:3px 10px;border-radius:2px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;}
.pill-rejected-ad{background:rgba(183,28,28,.2);color:#ef9a9a;padding:3px 10px;border-radius:2px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;}

/* ── WANTED / EQUIPMENT REQUESTS ── */
.wanted-page{max-width:1100px;margin:0 auto;padding:40px 24px;}
.wanted-hero{background:linear-gradient(135deg,rgba(100,180,100,.1) 0%,rgba(34,160,144,.08) 100%);border:1px solid var(--dune);border-radius:8px;padding:32px;text-align:center;margin-bottom:28px;}
.wanted-hero h1{font-family:'Oswald',sans-serif;font-size:30px;letter-spacing:2px;color:var(--ivory);margin-bottom:8px;}
.wanted-hero h1 span{color:#3ec963;}
.wanted-hero p{font-size:14px;color:var(--sand);font-weight:300;line-height:1.7;max-width:620px;margin:0 auto 20px;}
.wanted-cta-row{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:20px;}
.wanted-filters{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px;padding:14px 18px;background:var(--earth);border:1px solid var(--clay);border-radius:6px;}
.wanted-filters select,.wanted-filters input{background:var(--soil);color:var(--dust);border:1px solid var(--clay);border-radius:3px;padding:8px 12px;font-size:12px;font-family:'Lato',sans-serif;}
.wanted-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px;}
.wanted-card{background:var(--earth);border:1px solid var(--clay);border-radius:6px;padding:18px;transition:all .2s;cursor:pointer;position:relative;border-left:4px solid var(--dune);}
.wanted-card:hover{transform:translateY(-2px);border-color:var(--horizon);box-shadow:0 8px 20px rgba(0,0,0,.3);}
.wanted-card.urgent{border-left-color:#ef4444;}
.wanted-card.within_month{border-left-color:var(--horizon);}
.wanted-card.flexible{border-left-color:var(--teal-light);}
.wanted-urgency{display:inline-block;padding:2px 10px;border-radius:10px;font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px;}
.wanted-urgent-badge{background:rgba(239,68,68,.2);color:#ef9a9a;}
.wanted-soon-badge{background:rgba(232,146,12,.2);color:var(--horizon);}
.wanted-flex-badge{background:rgba(34,160,144,.2);color:var(--teal-light);}
.wanted-purpose-pill{display:inline-block;padding:2px 8px;border-radius:3px;font-size:10px;font-weight:700;letter-spacing:1px;margin-left:6px;text-transform:uppercase;}
.wp-buy{background:rgba(46,125,50,.2);color:#81c784;}
.wp-hire{background:rgba(33,150,243,.2);color:#81d4fa;}
.wp-either{background:rgba(156,39,176,.2);color:#ce93d8;}
.wanted-title{font-family:'Oswald',sans-serif;font-size:17px;color:var(--ivory);letter-spacing:.5px;margin-bottom:10px;line-height:1.25;}
.wanted-meta{display:flex;flex-wrap:wrap;gap:12px;font-size:11px;color:var(--sand);margin-bottom:12px;}
.wanted-meta span{display:flex;align-items:center;gap:4px;}
.wanted-desc{font-size:13px;color:var(--dust);line-height:1.55;margin-bottom:12px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;}
.wanted-budget{background:rgba(34,160,144,.08);border:1px solid var(--teal-light);border-radius:3px;padding:8px 12px;font-size:12px;color:var(--teal-light);margin-bottom:12px;font-weight:700;}
.wanted-footer{display:flex;justify-content:space-between;align-items:center;padding-top:10px;border-top:1px solid var(--clay);font-size:10px;color:var(--bark);}
.wanted-identity-hidden{display:inline-flex;align-items:center;gap:4px;color:var(--sand);}
.wanted-contact-blc{background:var(--savanna);color:var(--soil);padding:6px 14px;border-radius:3px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;border:none;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:4px;}
.wanted-contact-blc:hover{background:var(--horizon);}
.wanted-stats-bar{display:flex;justify-content:space-around;gap:16px;background:var(--earth);border:1px solid var(--clay);border-radius:6px;padding:16px;margin-bottom:20px;flex-wrap:wrap;}
.wanted-stat{text-align:center;}
.wanted-stat-n{font-family:'Oswald',sans-serif;font-size:22px;font-weight:900;color:#3ec963;}
.wanted-stat-l{font-size:10px;color:var(--sand);letter-spacing:1.5px;text-transform:uppercase;margin-top:2px;}

/* ── BIDDING SYSTEM ── */
.bid-badge{display:inline-flex;align-items:center;gap:4px;background:linear-gradient(135deg,#ff6b00 0%,#e85d04 100%);color:#fff;padding:4px 10px;border-radius:3px;font-family:'Oswald',sans-serif;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;box-shadow:0 2px 6px rgba(232,93,4,.3);animation:bidPulse 2s ease-in-out infinite;}
@keyframes bidPulse{0%,100%{transform:scale(1);}50%{transform:scale(1.03);}}
.bid-count-pill{background:rgba(232,93,4,.2);color:#ff8c42;padding:3px 10px;border-radius:3px;font-size:11px;font-weight:700;letter-spacing:1px;}
.bid-panel{background:linear-gradient(135deg,rgba(232,93,4,.08) 0%,rgba(232,93,4,.03) 100%);border:2px solid #e85d04;border-radius:6px;padding:20px;margin:16px 0;}
.bid-highest{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;background:rgba(0,0,0,.3);border-radius:4px;margin-bottom:14px;}
.bid-highest-label{font-family:'Oswald',sans-serif;font-size:11px;letter-spacing:2px;color:var(--sand);text-transform:uppercase;}
.bid-highest-amount{font-family:'Oswald',sans-serif;font-size:28px;font-weight:900;color:#ff8c42;}
.bid-form{display:flex;flex-direction:column;gap:12px;}
.bid-input-group{display:flex;gap:8px;align-items:stretch;}
.bid-currency{background:var(--clay);color:var(--ivory);padding:12px 14px;border-radius:3px 0 0 3px;font-family:'Oswald',sans-serif;font-size:14px;letter-spacing:1px;display:flex;align-items:center;}
.bid-input{flex:1;padding:12px;background:var(--soil);border:1px solid var(--clay);border-radius:0 3px 3px 0;color:var(--ivory);font-family:'Oswald',sans-serif;font-size:18px;font-weight:700;}
.bid-input:focus{outline:none;border-color:#e85d04;}
.bid-btn{background:linear-gradient(135deg,#ff6b00 0%,#e85d04 100%);color:#fff;border:none;padding:14px 28px;font-family:'Oswald',sans-serif;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;cursor:pointer;border-radius:3px;transition:all .2s;box-shadow:0 4px 12px rgba(232,93,4,.3);}
.bid-btn:hover{transform:translateY(-2px);box-shadow:0 6px 16px rgba(232,93,4,.5);}
.bid-btn:disabled{background:var(--clay);color:var(--bark);cursor:not-allowed;transform:none;box-shadow:none;}
.bid-history{margin-top:14px;max-height:200px;overflow-y:auto;}
.bid-row{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid rgba(61,41,16,.4);font-size:12px;}
.bid-row:last-child{border-bottom:none;}
.bid-row.winning{background:rgba(46,125,50,.1);border-left:3px solid var(--green-ok);padding-left:11px;}
.bid-status-pill{padding:2px 8px;border-radius:10px;font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;}
.bs-pending{background:rgba(232,146,12,.2);color:var(--horizon);}
.bs-accepted{background:rgba(46,125,50,.2);color:#81c784;}
.bs-rejected{background:rgba(183,28,28,.2);color:#ef9a9a;}
.bs-withdrawn{background:rgba(100,100,100,.2);color:var(--sand);}
.bs-winning{background:linear-gradient(135deg,#ff6b00,#e85d04);color:#fff;}
.bid-min-note{font-size:11px;color:var(--sand);opacity:.8;margin-top:4px;}

/* ── WANTED BOARD (Buyer Requests) ── */
.wanted-hero{background:linear-gradient(135deg,rgba(109,179,232,.12) 0%,rgba(34,160,144,.08) 100%);border:1px solid var(--dune);border-radius:8px;padding:36px;text-align:center;margin-bottom:36px;}
.wanted-hero h1{font-family:'Oswald',sans-serif;font-size:32px;letter-spacing:2px;color:var(--ivory);margin-bottom:8px;}
.wanted-hero h1 span{color:#6db3e8;}
.wanted-hero p{font-size:14px;color:var(--sand);font-weight:300;line-height:1.7;max-width:620px;margin:0 auto 20px;}
.wanted-cta-row{display:flex;justify-content:center;gap:12px;flex-wrap:wrap;}
.wanted-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:14px;margin:24px 0;}
.wanted-stat{background:var(--earth);border:1px solid var(--clay);border-radius:4px;padding:14px;text-align:center;}
.wanted-stat-n{font-family:'Oswald',sans-serif;font-size:22px;color:#6db3e8;font-weight:700;}
.wanted-stat-l{font-size:10px;color:var(--sand);letter-spacing:1.5px;text-transform:uppercase;margin-top:4px;}
.wanted-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px;}
.wanted-card{background:var(--earth);border:1px solid var(--clay);border-radius:6px;padding:18px;transition:all .2s;position:relative;overflow:hidden;}
.wanted-card::before{content:"";position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#6db3e8,var(--teal-light));}
.wanted-card:hover{border-color:#6db3e8;transform:translateY(-2px);box-shadow:0 6px 16px rgba(0,0,0,.3);}
.wanted-card.urgent{border-color:#ff6b00;background:linear-gradient(135deg,rgba(255,107,0,.06) 0%,var(--earth) 100%);}
.wanted-card.urgent::before{background:linear-gradient(90deg,#ff6b00,#e85d04);}
.wanted-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;gap:10px;}
.wanted-ref{font-size:10px;color:var(--bark);font-family:monospace;}
.wanted-type-pill{display:inline-block;padding:3px 10px;border-radius:3px;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;}
.wt-hire{background:rgba(34,160,144,.2);color:var(--teal-light);}
.wt-sale{background:rgba(232,146,12,.2);color:var(--horizon);}
.wanted-cat{font-family:'Oswald',sans-serif;font-size:18px;color:var(--ivory);letter-spacing:1px;margin-bottom:6px;font-weight:700;}
.wanted-region{font-size:12px;color:var(--horizon);font-weight:700;margin-bottom:10px;}
.wanted-desc{font-size:13px;color:var(--dust);line-height:1.6;margin-bottom:12px;}
.wanted-budget{background:var(--soil);border:1px solid var(--clay);border-radius:4px;padding:10px 14px;margin-bottom:10px;}
.wanted-budget-label{font-size:10px;color:var(--sand);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:2px;}
.wanted-budget-amt{font-family:'Oswald',sans-serif;font-size:18px;color:#6db3e8;font-weight:700;}
.wanted-meta{display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--bark);padding-top:10px;border-top:1px solid var(--clay);}
.wanted-urgency{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:10px;font-size:10px;font-weight:700;letter-spacing:1px;}
.wu-urgent{background:rgba(255,107,0,.2);color:#ff8c42;}
.wu-within_month{background:rgba(232,146,12,.2);color:var(--horizon);}
.wu-flexible{background:rgba(100,130,100,.2);color:#90c890;}
.wanted-contact-hidden{background:rgba(109,179,232,.06);border:1px dashed var(--clay);border-radius:3px;padding:10px;text-align:center;font-size:11px;color:var(--sand);margin-top:10px;}
.wanted-contact-hidden strong{color:#6db3e8;}
.wanted-form-modal{background:var(--earth);border:1px solid var(--dune);border-radius:8px;padding:28px;max-width:620px;margin:0 auto;}

/* ── LANGUAGE PICKER ── */
.lang-picker{display:inline-flex;align-items:center;gap:4px;background:var(--soil);border:1px solid var(--clay);border-radius:3px;padding:4px 8px;cursor:pointer;font-size:11px;color:var(--sand);transition:all .2s;position:relative;}
.lang-picker:hover{border-color:var(--horizon);color:var(--ivory);}
.lang-dropdown{position:absolute;top:100%;right:0;margin-top:4px;background:var(--earth);border:1px solid var(--clay);border-radius:4px;min-width:140px;z-index:200;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.4);}
.lang-opt{display:flex;align-items:center;gap:8px;padding:10px 14px;cursor:pointer;transition:background .15s;font-size:12px;color:var(--dust);border:none;background:none;width:100%;text-align:left;font-family:'Lato',sans-serif;}
.lang-opt:hover{background:var(--soil);color:var(--horizon);}
.lang-opt.active{background:rgba(232,146,12,.1);color:var(--horizon);font-weight:700;}

/* ── SMS NOTIFICATION PANEL ── */
.sms-panel{background:var(--earth);border:1px solid var(--clay);border-radius:6px;padding:20px;margin-bottom:24px;}
.sms-row{display:flex;gap:12px;padding:10px 0;border-bottom:1px solid rgba(61,41,16,.4);align-items:center;}
.sms-row:last-child{border-bottom:none;}
.sms-icon{width:32px;height:32px;border-radius:50%;background:rgba(34,160,144,.15);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;}
.sms-msg{flex:1;font-size:12px;color:var(--dust);line-height:1.5;}
.sms-meta{font-size:10px;color:var(--bark);margin-top:2px;}
.sms-badge{padding:2px 8px;border-radius:10px;font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;white-space:nowrap;}
.sms-sent{background:rgba(46,125,50,.2);color:#81c784;}
.sms-pending{background:rgba(232,146,12,.2);color:var(--horizon);}

/* ── BULK IMPORT ── */
.bulk-import-card{background:var(--earth);border:2px dashed var(--clay);border-radius:6px;padding:24px;margin-bottom:20px;}
.bulk-template{background:var(--soil);border:1px solid var(--clay);border-radius:3px;padding:14px;font-family:'Courier New',monospace;font-size:11px;color:var(--sand);line-height:1.6;overflow-x:auto;white-space:pre;}
.bulk-preview-table{width:100%;border-collapse:collapse;margin-top:14px;font-size:11px;}
.bulk-preview-table th{background:var(--clay);color:var(--horizon);padding:8px;text-align:left;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;}
.bulk-preview-table td{padding:6px 8px;border-bottom:1px solid rgba(61,41,16,.3);color:var(--dust);}
.bulk-preview-table tr.invalid td{background:rgba(183,28,28,.1);color:#ef9a9a;}
.bulk-preview-table tr.valid td{background:rgba(46,125,50,.05);}

/* ── ANALYTICS DASHBOARD ── */
.analytics-page{max-width:1280px;margin:0 auto;padding:32px;}
.analytics-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:28px;flex-wrap:wrap;gap:14px;}
.analytics-title{font-family:'Oswald',sans-serif;font-size:28px;letter-spacing:2px;color:var(--ivory);}
.analytics-title span{color:var(--horizon);}
.period-tabs{display:flex;gap:4px;}
.period-tab{background:transparent;border:1px solid var(--clay);color:var(--sand);padding:6px 14px;font-family:'Lato',sans-serif;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;border-radius:3px;transition:all .2s;}
.period-tab.active{background:var(--savanna);border-color:var(--savanna);color:var(--soil);}
.kpi-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:14px;margin-bottom:28px;}
.kpi-card{background:var(--earth);border:1px solid var(--clay);border-radius:6px;padding:18px 16px;position:relative;overflow:hidden;transition:transform .2s;}
.kpi-card:hover{transform:translateY(-2px);}
.kpi-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;}
.kpi-card.revenue::before{background:var(--horizon);}
.kpi-card.bookings::before{background:var(--teal-light);}
.kpi-card.listings::before{background:var(--savanna);}
.kpi-card.leads::before{background:#6db3e8;}
.kpi-card.ads-rev::before{background:var(--gold);}
.kpi-card.conversion::before{background:#a78bfa;}
.kpi-label{font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--sand);margin-bottom:8px;}
.kpi-value{font-family:'Oswald',sans-serif;font-size:28px;letter-spacing:1px;line-height:1;margin-bottom:4px;}
.kpi-card.revenue .kpi-value{color:var(--horizon);}
.kpi-card.bookings .kpi-value{color:var(--teal-light);}
.kpi-card.listings .kpi-value{color:var(--savanna);}
.kpi-card.leads .kpi-value{color:#6db3e8;}
.kpi-card.ads-rev .kpi-value{color:var(--gold);}
.kpi-card.conversion .kpi-value{color:#a78bfa;}
.kpi-sub{font-size:11px;color:var(--bark);}
.kpi-trend{font-size:10px;margin-top:4px;font-weight:700;}
.kpi-trend.up{color:#81c784;}
.kpi-trend.down{color:#ef9a9a;}
.kpi-trend.flat{color:var(--bark);}
.charts-grid{display:grid;grid-template-columns:2fr 1fr;gap:20px;margin-bottom:24px;}
.chart-card{background:var(--earth);border:1px solid var(--clay);border-radius:6px;padding:20px;}
.chart-title{font-family:'Oswald',sans-serif;font-size:16px;letter-spacing:1px;color:var(--ivory);margin-bottom:4px;}
.chart-sub{font-size:11px;color:var(--bark);margin-bottom:16px;}
.bar-chart{display:flex;align-items:flex-end;gap:6px;height:140px;padding-bottom:24px;position:relative;}
.bar-wrap{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;height:100%;}
.bar{width:100%;border-radius:3px 3px 0 0;transition:opacity .2s;cursor:default;min-height:2px;}
.bar:hover{opacity:.8;}
.bar-label{font-size:9px;color:var(--bark);letter-spacing:.5px;white-space:nowrap;text-align:center;}
.bar-val{font-size:9px;color:var(--sand);font-weight:700;}
.chart-y-axis{position:absolute;left:0;top:0;bottom:24px;display:flex;flex-direction:column;justify-content:space-between;pointer-events:none;}
.chart-y-tick{font-size:9px;color:var(--clay);}
.donut-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;}
.donut-legend{width:100%;display:flex;flex-direction:column;gap:6px;}
.donut-legend-item{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--dust);}
.donut-dot{width:10px;height:10px;border-radius:2px;flex-shrink:0;}
.activity-feed{background:var(--earth);border:1px solid var(--clay);border-radius:6px;padding:20px;margin-bottom:24px;}
.activity-item{display:flex;align-items:flex-start;gap:12px;padding:10px 0;border-bottom:1px solid rgba(61,41,16,.4);}
.activity-item:last-child{border-bottom:none;}
.activity-icon{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;}
.activity-text{flex:1;}
.activity-title{font-size:13px;color:var(--dust);font-weight:500;}
.activity-meta{font-size:11px;color:var(--bark);margin-top:2px;}
.top-table{width:100%;border-collapse:collapse;}
.top-table th{font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--dune);text-align:left;padding:8px 10px;border-bottom:1px solid var(--clay);}
.top-table td{font-size:12px;color:var(--dust);padding:10px 10px;border-bottom:1px solid rgba(61,41,16,.3);}
.top-table tr:hover td{background:var(--smoke);}
.sparkline{display:inline-flex;align-items:flex-end;gap:2px;height:20px;}
.spark-bar{width:4px;border-radius:1px;background:var(--savanna);}
.revenue-projection{background:linear-gradient(135deg,rgba(232,146,12,.08) 0%,rgba(34,160,144,.06) 100%);border:1px solid var(--dune);border-radius:6px;padding:20px;margin-bottom:24px;}
.proj-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px;margin-top:14px;}
.proj-item{background:rgba(0,0,0,.2);border-radius:4px;padding:14px;}
.proj-label{font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--dune);margin-bottom:6px;}
.proj-value{font-family:'Oswald',sans-serif;font-size:22px;letter-spacing:1px;}
.proj-note{font-size:10px;color:var(--bark);margin-top:4px;}

@media(max-width:900px){.charts-grid{grid-template-columns:1fr;}}
@media(max-width:600px){.kpi-grid{grid-template-columns:1fr 1fr;}.analytics-page{padding:16px;}}
.owner-ag-wrap{background:var(--soil);border:2px solid var(--teal-light);border-radius:6px;overflow:hidden;margin-top:14px;}
.owner-ag-wrap.sale-ag{border-color:var(--teal-light);}
.owner-ag-header{padding:16px 20px;border-bottom:1px solid var(--clay);text-align:center;}
.owner-ag-header.hire-ag{background:rgba(212,118,10,.12);}
.owner-ag-header.sale-ag-h{background:rgba(34,160,144,.12);}
.owner-ag-header h3{font-family:'Oswald',sans-serif;font-size:19px;letter-spacing:2px;color:var(--ivory);margin-bottom:2px;}
.owner-ag-header p{font-size:11px;color:var(--sand);letter-spacing:1px;}
.owner-ag-body{padding:0 20px 20px;max-height:400px;overflow-y:auto;font-size:12px;color:var(--dust);line-height:1.75;}
.owner-ag-body::-webkit-scrollbar{width:4px;}
.owner-ag-body::-webkit-scrollbar-track{background:var(--soil);}
.owner-ag-body::-webkit-scrollbar-thumb{background:var(--clay);border-radius:2px;}
.owner-submit-step{display:flex;gap:0;margin-bottom:20px;}
.owner-step-ind{flex:1;padding:8px;text-align:center;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;border-bottom:2px solid var(--clay);color:var(--bark);transition:all .2s;}
.owner-step-ind.active{border-bottom-color:var(--teal-light);color:var(--teal-light);}
.owner-step-ind.done{border-bottom-color:var(--green-ok);color:#81c784;}

@media(max-width:900px){
  .search-bar{grid-template-columns:1fr;}
  .sf{border-right:none;border-bottom:1px solid var(--clay);}
  .modal-info-grid{grid-template-columns:1fr 1fr;}
  .pricing-grid{grid-template-columns:1fr;}
  .if-row{grid-template-columns:1fr;}
  .chat-panel{width:300px;}
}
@media(max-width:680px){
  .nav{padding:0 16px;}
  .nav-tabs{display:none;}
  .main,.submit-page,.admin-page,.pricing-page{padding:22px 16px;}
  .form-row{grid-template-columns:1fr;}
  .modal-info-grid{grid-template-columns:1fr;}
  .hero{padding:42px 16px 34px;}
  .contact-strip{padding:7px 16px;}
  .type-selector{grid-template-columns:1fr;}
  .hero-stats{gap:26px;}
  .chat-panel{width:calc(100vw - 48px);right:-24px;}
  .ag-parties{grid-template-columns:1fr;}
  .sig-row{grid-template-columns:1fr;}
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// AVAILABILITY CALENDAR
// ─────────────────────────────────────────────────────────────────────────────
function AvailabilityCalendar({ bookings, listingId, onSelectRange }) {
  const today = new Date(); today.setHours(0,0,0,0);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selStart, setSelStart] = useState(null);
  const [selEnd, setSelEnd] = useState(null);
  const [hovDay, setHovDay] = useState(null);

  const bookedRanges = getBookedRanges(bookings, listingId);

  const isBooked = (date) => bookedRanges.some(r => date >= r.start && date <= r.end);
  const isPast = (date) => date < today;
  const inSelRange = (date) => {
    if (!selStart) return false;
    const end = selEnd || hovDay;
    if (!end) return false;
    const lo = selStart < end ? selStart : end;
    const hi = selStart < end ? end : selStart;
    return date > lo && date < hi;
  };

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  const handleDayClick = (date) => {
    if (isPast(date) || isBooked(date)) return;
    if (!selStart || (selStart && selEnd)) {
      setSelStart(date); setSelEnd(null);
    } else {
      if (date < selStart) { setSelEnd(selStart); setSelStart(date); }
      else setSelEnd(date);
    }
  };

  useEffect(() => {
    if (selStart && selEnd) onSelectRange(selStart, selEnd);
  }, [selStart, selEnd]);

  const fmtDate = d => d.toISOString().split("T")[0];

  return (
    <div className="calendar-wrap">
      <div className="cal-header">
        <button className="cal-nav" onClick={() => { const d=new Date(viewYear,viewMonth-1,1); setViewYear(d.getFullYear()); setViewMonth(d.getMonth()); }}>‹</button>
        <div className="cal-month">{monthNames[viewMonth]} {viewYear}</div>
        <button className="cal-nav" onClick={() => { const d=new Date(viewYear,viewMonth+1,1); setViewYear(d.getFullYear()); setViewMonth(d.getMonth()); }}>›</button>
      </div>
      <div className="cal-grid">
        {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => <div key={d} className="cal-day-name">{d}</div>)}
        {Array.from({length: firstDay}).map((_,i) => <div key={`e${i}`} className="cal-day empty" />)}
        {Array.from({length: daysInMonth}).map((_,i) => {
          const date = new Date(viewYear, viewMonth, i+1);
          const dateStr = fmtDate(date);
          const isToday = date.toDateString() === today.toDateString();
          const booked = isBooked(date);
          const past = isPast(date);
          const isStart = selStart && date.toDateString() === selStart.toDateString();
          const isEnd = selEnd && date.toDateString() === selEnd.toDateString();
          const inRange = inSelRange(date);
          let cls = "cal-day";
          if (past) cls += " past";
          else if (booked) cls += " booked";
          else cls += " available";
          if (isStart) cls += " selected-start";
          if (isEnd) cls += " selected-end";
          if (inRange) cls += " selected-range";
          if (isToday) cls += " today";
          return (
            <div key={dateStr} className={cls}
              onClick={() => handleDayClick(date)}
              onMouseEnter={() => selStart && !selEnd && setHovDay(date)}
              onMouseLeave={() => setHovDay(null)}
              title={booked ? "Already booked" : past ? "Past date" : dateStr}>
              {i+1}
            </div>
          );
        })}
      </div>
      <div className="cal-legend">
        <div className="cal-legend-item"><div className="cal-legend-dot" style={{background:"var(--savanna)"}} />Selected</div>
        <div className="cal-legend-item"><div className="cal-legend-dot" style={{background:"rgba(239,68,68,.3)",border:"1px solid #ef9a9a"}} />Booked</div>
        <div className="cal-legend-item"><div className="cal-legend-dot" style={{background:"var(--clay)"}} />Unavailable</div>
        <div className="cal-legend-item"><div className="cal-legend-dot" style={{background:"var(--earth)",border:"1px solid var(--dune)"}} />Available</div>
      </div>
      {selStart && !selEnd && <div style={{marginTop:10,fontSize:12,color:"var(--sand)"}}>📅 Start: <strong>{fmtDate(selStart)}</strong> — now tap an end date</div>}
      {selStart && selEnd && (
        <div style={{marginTop:10,fontSize:12,color:"var(--horizon)",fontWeight:700}}>
          📅 {fmtDate(selStart)} → {fmtDate(selEnd)}
          <button style={{marginLeft:12,background:"transparent",border:"none",color:"var(--bark)",cursor:"pointer",fontSize:11}} onClick={() => {setSelStart(null);setSelEnd(null);}}>✕ Clear</button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HIRE AGREEMENT TEXT
// ─────────────────────────────────────────────────────────────────────────────
function HireAgreementText({ listing, bForm, startDate, endDate, days, totalCost }) {
  const today = new Date().toLocaleDateString("en-NA", {day:"numeric",month:"long",year:"numeric"});
  const fmtDate = d => d ? new Date(d).toLocaleDateString("en-NA",{day:"numeric",month:"long",year:"numeric"}) : "";
  return (
    <div className="agreement-wrap">
      <div className="agreement-header">
        <h3>PLANT HIRE AGREEMENT</h3>
        <p>BLC SUPPLIERS AND TRADING · CC/2017/00361 · NAMIBIA</p>
      </div>
      <div className="agreement-body">

        <div style={{textAlign:"center",padding:"16px 0 8px",borderBottom:"1px solid var(--clay)",marginBottom:4}}>
          <div style={{fontFamily:"Oswald,sans-serif",fontSize:15,color:"var(--ivory)",letterSpacing:"1px"}}>PLANT &amp; EQUIPMENT HIRE AGREEMENT</div>
          <div style={{fontSize:11,color:"var(--sand)",marginTop:4}}>This Agreement is entered into on <strong style={{color:"var(--dust)"}}>{today}</strong></div>
        </div>

        <div className="ag-parties">
          <div>
            <div className="ag-party-label">Hire Company (Lessor)</div>
            <div className="ag-party-value">BLC Suppliers and Trading</div>
            <div className="ag-party-sub">CC/2017/00361 · Rosh Pinah, Namibia</div>
            <div className="ag-party-sub">Tel: +264 81 603 4139</div>
            <div className="ag-party-sub">blc.bertus@gmail.com</div>
          </div>
          <div>
            <div className="ag-party-label">Hiring Company (Lessee)</div>
            <div className="ag-party-value">{bForm.company || bForm.name || "—"}</div>
            <div className="ag-party-sub">{bForm.name}</div>
            <div className="ag-party-sub">Tel: {bForm.phone}</div>
            {bForm.email && <div className="ag-party-sub">{bForm.email}</div>}
          </div>
        </div>

        <div className="ag-section">
          <h4>1. Equipment Details</h4>
          <ul>
            <li><strong>Equipment:</strong> {listing.name}</li>
            <li><strong>Category:</strong> {listing.category}</li>
            <li><strong>Condition at dispatch:</strong> {listing.condition || "As described in listing"}</li>
            <li><strong>Year:</strong> {listing.year || "As per listing"}</li>
            {listing.hours && <li><strong>Hours at dispatch:</strong> {parseInt(listing.hours).toLocaleString()} hrs</li>}
            <li><strong>Hire Period:</strong> {fmtDate(startDate)} to {fmtDate(endDate)} ({days} day{days!==1?"s":""})</li>
            <li><strong>Hire Rate:</strong> N$ {parseInt(listing.price).toLocaleString()} per {listing.unit}</li>
            <li><strong>Estimated Total:</strong> N$ {totalCost.toLocaleString()} (excl. VAT)</li>
            <li><strong>Delivery Location:</strong> {listing.location}, {listing.region}</li>
          </ul>
        </div>

        <div className="ag-section">
          <h4>2. Payment Terms</h4>
          <ul>
            <li>A <strong>50% deposit</strong> is due before equipment is dispatched to site.</li>
            <li>The remaining <strong>50% balance</strong> is due within 7 days of equipment return or end of hire period, whichever comes first.</li>
            <li>All payments to be made to: <strong>Bank Windhoek, Acc: 8052167764, Branch: 486-372 (Capricon Branch)</strong>, reference: HIRE-[Lessee Name].</li>
            <li>Overdue payments attract interest at <strong>2% per month</strong> calculated from the due date.</li>
            <li>BLC reserves the right to recall equipment immediately if payment is not received within the agreed terms.</li>
            <li>All amounts are in Namibian Dollars (N$) and subject to applicable VAT at the prevailing rate.</li>
            <li>Bank charges and transaction fees are for the account of the Lessee.</li>
          </ul>
        </div>

        <div className="ag-section">
          <h4>3. Delivery, Collection &amp; Transport</h4>
          <ul>
            <li>Equipment will be delivered to the agreed site address on the confirmed start date, subject to road and weather conditions.</li>
            <li>Transport costs to and from site are <strong>for the account of the Lessee</strong> unless otherwise agreed in writing by BLC.</li>
            <li>The Lessee must ensure safe, accessible site conditions for delivery and collection vehicles.</li>
            <li>Any delays in collection caused by the Lessee will result in additional hire charges at the standard daily rate.</li>
            <li>Equipment must be accessible for collection on the agreed end date. Failure to make equipment available will be treated as a hire extension.</li>
          </ul>
        </div>

        <div className="ag-section">
          <h4>4. Lessee Responsibilities &amp; Obligations</h4>
          <ul>
            <li>The Lessee accepts the equipment in its current condition and acknowledges receipt by accepting this agreement.</li>
            <li>The Lessee is solely responsible for the equipment from the time of delivery until it is returned to BLC in the same condition.</li>
            <li>The Lessee must operate the equipment only for its intended purpose and within manufacturer-specified operating limits.</li>
            <li>Only qualified, licensed operators may operate the equipment. The Lessee is responsible for ensuring operator competency and compliance with all applicable Namibian safety regulations.</li>
            <li>The Lessee must comply with all applicable laws, regulations, and site safety requirements including the <strong>Labour Act, Mines, Works and Minerals Act, and Occupational Health and Safety requirements</strong>.</li>
            <li>The Lessee is responsible for daily pre-start inspections and must maintain equipment fluid levels (fuel, oil, coolant, hydraulic fluid) unless otherwise agreed.</li>
            <li>The equipment must not be operated outside the agreed hire site without prior written consent from BLC.</li>
            <li>The Lessee must not sub-hire, lend, or transfer possession of the equipment to any third party without written approval from BLC.</li>
            <li>The Lessee must immediately notify BLC of any accident, breakdown, damage, theft, or loss involving the equipment.</li>
          </ul>
        </div>

        <div className="ag-section">
          <h4>5. Damage, Loss &amp; Theft</h4>
          <ul>
            <li>The Lessee is fully liable for any damage to the equipment beyond normal wear and tear that occurs during the hire period.</li>
            <li>In the event of theft or total loss, the Lessee is liable for the full replacement value of the equipment at current market rates.</li>
            <li>Damage repair costs will be assessed by BLC and invoiced to the Lessee at the actual repair cost plus a 15% administration fee.</li>
            <li>The Lessee must obtain adequate insurance covering the equipment against damage, loss, and third-party liability for the full duration of the hire period. Proof of insurance may be requested by BLC.</li>
            <li>BLC's liability is limited to the hire rate paid and BLC accepts no liability for consequential losses, loss of production, or loss of profit arising from equipment downtime.</li>
            <li>Vandalism or wilful damage is the sole responsibility of the Lessee regardless of cause.</li>
          </ul>
        </div>

        <div className="ag-section">
          <h4>6. Breakdown &amp; Maintenance</h4>
          <ul>
            <li>BLC will repair mechanical breakdowns arising from normal use within a <strong>reasonable response time</strong>. Response targets: Khomas Region 4hrs; Other regions 24hrs.</li>
            <li>No hire charge will accrue during confirmed mechanical breakdown periods exceeding 4 hours, provided BLC is notified immediately.</li>
            <li>Breakdowns caused by operator misuse, overloading, lack of routine maintenance, or accident are <strong>not covered</strong> by BLC and the hire charge continues.</li>
            <li>The Lessee must not attempt repairs without prior written authorisation from BLC. Unauthorised repairs will be charged to the Lessee.</li>
            <li>The Lessee must not modify the equipment in any way without written consent from BLC.</li>
          </ul>
        </div>

        <div className="ag-section">
          <h4>7. Fuel &amp; Consumables</h4>
          <ul>
            <li>Unless otherwise stated, equipment is delivered with a full tank of fuel. The Lessee is responsible for maintaining fuel levels during the hire period.</li>
            <li>Equipment must be returned with a full tank. Failure to do so will result in a refuelling charge at market rate plus a 20% handling fee.</li>
            <li>Only the correct grade of fuel and lubricants as specified by the manufacturer must be used. Any damage caused by incorrect fuel is the Lessee's liability.</li>
          </ul>
        </div>

        <div className="ag-section">
          <h4>8. Cancellation &amp; Early Termination</h4>
          <ul>
            <li>Cancellations made <strong>more than 48 hours</strong> before the hire start date: full deposit refund minus a N$500 administration fee.</li>
            <li>Cancellations made <strong>within 48 hours</strong> of the start date: deposit is forfeited.</li>
            <li>Early return of equipment does not entitle the Lessee to a refund of any portion of pre-paid hire charges.</li>
            <li>BLC may terminate this agreement immediately if the Lessee breaches any term of this agreement, fails to make payment, or misuses the equipment. No refund will be due upon termination for breach.</li>
            <li>In the event of early termination by BLC due to no fault of the Lessee, a pro-rata refund of unused hire days will be issued within 14 business days.</li>
          </ul>
        </div>

        <div className="ag-section">
          <h4>9. Extension of Hire Period</h4>
          <ul>
            <li>Hire extensions must be requested at least <strong>24 hours</strong> before the agreed end date and are subject to equipment availability.</li>
            <li>Extensions are charged at the same daily rate as the original agreement.</li>
            <li>Failure to return equipment on the agreed date without notification constitutes an automatic extension and the Lessee will be charged accordingly.</li>
          </ul>
        </div>

        <div className="ag-section">
          <h4>10. Environmental Obligations</h4>
          <ul>
            <li>The Lessee is responsible for environmental compliance at the operating site including spill containment, waste disposal, and compliance with the <strong>Environmental Management Act of Namibia</strong>.</li>
            <li>Any environmental damage or fines resulting from the use of the equipment are the sole responsibility of the Lessee.</li>
            <li>The Lessee must ensure that refuelling is conducted safely and that no fuel or lubricants are spilled on or near watercourses.</li>
          </ul>
        </div>

        <div className="ag-section">
          <h4>11. Indemnity &amp; Liability</h4>
          <ul>
            <li>The Lessee indemnifies BLC Suppliers and Trading, its directors, employees, and agents against all claims, damages, costs, and expenses arising from the use of the equipment during the hire period.</li>
            <li>BLC makes no warranty as to the fitness of the equipment for any particular purpose beyond its stated category and description.</li>
            <li>BLC's total liability to the Lessee under this agreement shall not exceed the total hire charges paid for the relevant hire period.</li>
          </ul>
        </div>

        <div className="ag-section">
          <h4>12. Dispute Resolution</h4>
          <ul>
            <li>Any dispute arising from this agreement shall first be referred to <strong>mediation</strong> within 14 days of written notice of the dispute.</li>
            <li>If mediation fails, disputes shall be resolved by arbitration under the <strong>Arbitration Act of Namibia</strong>.</li>
            <li>This agreement is governed by the <strong>laws of the Republic of Namibia</strong>.</li>
            <li>The parties consent to the jurisdiction of the <strong>High Court of Namibia, Main Division</strong>.</li>
          </ul>
        </div>

        <div className="ag-section">
          <h4>13. Force Majeure</h4>
          <p>Neither party shall be liable for delays or failure to perform obligations under this agreement caused by circumstances beyond their reasonable control, including but not limited to acts of God, government restrictions, civil unrest, pandemic, flood, or fire, provided the affected party gives written notice within 48 hours.</p>
        </div>

        <div className="ag-section">
          <h4>14. General Conditions</h4>
          <ul>
            <li>This agreement constitutes the entire agreement between the parties and supersedes all prior discussions or representations.</li>
            <li>No variation of this agreement is valid unless made in writing and signed by both parties.</li>
            <li>If any provision of this agreement is found to be unenforceable, the remaining provisions continue in full force.</li>
            <li>Headings are for convenience only and do not affect the interpretation of this agreement.</li>
            <li>This agreement is binding on the Lessee's successors, heirs, and assigns.</li>
          </ul>
        </div>

        <div style={{marginTop:18,padding:"12px 16px",background:"rgba(232,146,12,.08)",border:"1px solid var(--dune)",borderRadius:3,fontSize:11,color:"var(--sand)",lineHeight:1.7}}>
          <strong style={{color:"var(--horizon)"}}>IMPORTANT:</strong> By accepting this agreement electronically, the Lessee confirms they have read, understood, and agree to be bound by all terms and conditions above. Electronic acceptance constitutes a valid and binding signature under Namibian law.
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BOOKING FORM (inside detail modal for hire listings) — 3-step with agreement
// ─────────────────────────────────────────────────────────────────────────────
function BookingForm({ listing, bookings, onBook }) {
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [bForm, setBForm] = useState({ name:"", phone:"", email:"", company:"", idNumber:"", vatNumber:"", notes:"" });
  const [step, setStep] = useState("calendar"); // calendar | agreement | confirmed
  const [conflict, setConflict] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedDeposit, setAgreedDeposit] = useState(false);
  const [agreedInsurance, setAgreedInsurance] = useState(false);
  const [agreedOperator, setAgreedOperator] = useState(false);
  const [sigName, setSigName] = useState("");
  const [sigDate] = useState(new Date().toLocaleDateString("en-NA"));
  const agreeRef = useRef();

  const bf = (k,v) => setBForm(f=>({...f,[k]:v}));
  const daysBetween = (s,e) => Math.max(1, Math.ceil((new Date(e)-new Date(s))/86400000)+1);
  const days = startDate && endDate ? daysBetween(startDate, endDate) : 0;
  const unitMult = listing.unit==="hour"?8:listing.unit==="week"?(days/7):listing.unit==="month"?(days/30):days;
  const totalCost = Math.ceil(unitMult * parseInt(listing.price));
  const deposit = Math.ceil(totalCost * 0.5);

  const handleRangeSelect = (s, e) => {
    const hasConflict = isDateRangeBooked(bookings, listing.id, s.toISOString().split("T")[0], e.toISOString().split("T")[0]);
    setConflict(hasConflict);
    setStartDate(s.toISOString().split("T")[0]);
    setEndDate(e.toISOString().split("T")[0]);
  };

  const canProceedToAgreement = !conflict && startDate && endDate && bForm.name && bForm.phone;

  const canSubmit = agreedTerms && agreedDeposit && agreedInsurance && agreedOperator && sigName.trim().length > 1;

  const submitBooking = () => {
    if (!canSubmit) { alert("Please confirm all checkboxes and type your full name as signature."); return; }
    onBook({
      id:`bk_${Date.now()}`, listingId:listing.id, listingName:listing.name,
      startDate, endDate, days, totalCost, deposit,
      bookedBy:bForm, status:"pending",
      submittedAt:Date.now(), unit:listing.unit,
      agreementAccepted:true, agreementDate:new Date().toISOString(),
      signature:sigName, agreedTo:["terms","deposit","insurance","operator"]
    });
    setStep("confirmed");
  };

  const fmtDate = d => d ? new Date(d).toLocaleDateString("en-NA",{day:"numeric",month:"short",year:"numeric"}) : "";

  if (step === "confirmed") {
    return (
      <div className="booking-confirmed">
        <div style={{fontSize:32,marginBottom:10}}>📅✅</div>
        <div style={{fontFamily:"Oswald,sans-serif",fontSize:20,color:"#81c784",letterSpacing:"1px",marginBottom:10}}>Booking Request Submitted!</div>
        <div style={{fontSize:13,color:"var(--dust)",lineHeight:1.8,marginBottom:14}}>
          <strong style={{color:"var(--ivory)"}}>{listing.name}</strong><br />
          {fmtDate(startDate)} → {fmtDate(endDate)} · {days} day{days!==1?"s":""}<br />
          Est. Total: <strong>N$ {totalCost.toLocaleString()}</strong> · Deposit Due: <strong>N$ {deposit.toLocaleString()}</strong>
        </div>
        <div style={{background:"rgba(232,146,12,.1)",border:"1px solid var(--dune)",borderRadius:3,padding:"12px 16px",fontSize:12,color:"var(--sand)",lineHeight:1.7,textAlign:"left",marginBottom:12}}>
          <strong style={{color:"var(--horizon)"}}>Next Step — Pay Your Deposit:</strong><br />
          Transfer <strong>N$ {deposit.toLocaleString()}</strong> to Bank Windhoek<br />
          Account: <strong>8052167764</strong> · Branch: <strong>486-372</strong><br />
          Reference: <strong>HIRE-{bForm.name.split(" ")[0].toUpperCase()}</strong><br />
          BLC will confirm your booking upon receipt of payment.
        </div>
        <div style={{fontSize:12,color:"var(--sand)"}}>A BLC agent will contact you at <strong>{bForm.phone}</strong> within 2 hours.<br />Your signed agreement reference: <strong>BLC-{Date.now().toString().slice(-6)}</strong></div>
      </div>
    );
  }

  return (
    <div>
      {/* Step indicator */}
      <div className="step-indicator">
        {[["1","Dates",step==="calendar"],["2","Details",step==="calendar"],["3","Agreement",step==="agreement"]].map(([n,l,active],i)=>(
          <div key={n} className={`step-ind${step==="agreement"&&i<2?" done":active?" active":""}`}>{n}. {l}</div>
        ))}
      </div>

      <div className="avail-title">📅 CHECK AVAILABILITY &amp; BOOK</div>
      <AvailabilityCalendar bookings={bookings} listingId={listing.id} onSelectRange={handleRangeSelect} />

      {conflict && startDate && endDate && (
        <div style={{background:"rgba(239,68,68,.12)",border:"1px solid #ef4444",borderRadius:3,padding:"10px 14px",marginBottom:12,fontSize:13,color:"#ef9a9a"}}>
          ⚠️ These dates overlap an existing booking. Please select different dates.
        </div>
      )}

      {startDate && endDate && !conflict && step === "calendar" && (
        <>
          <div className="booking-summary">
            <div className="bs-row"><span className="bs-label">Equipment</span><span className="bs-value">{listing.name}</span></div>
            <div className="bs-row"><span className="bs-label">Start Date</span><span className="bs-value">{fmtDate(startDate)}</span></div>
            <div className="bs-row"><span className="bs-label">End Date</span><span className="bs-value">{fmtDate(endDate)}</span></div>
            <div className="bs-row"><span className="bs-label">Duration</span><span className="bs-value">{days} day{days!==1?"s":""}</span></div>
            <div className="bs-row"><span className="bs-label">Rate</span><span className="bs-value">N$ {parseInt(listing.price).toLocaleString()} / {listing.unit}</span></div>
            <div className="bs-row"><span className="bs-label">Est. Total</span><span className="bs-total">N$ {totalCost.toLocaleString()}</span></div>
            <div className="bs-row"><span className="bs-label">Deposit (50%)</span><span className="bs-value" style={{color:"var(--teal-light)"}}>N$ {deposit.toLocaleString()}</span></div>
          </div>

          <div className="booking-form">
            <div className="booking-form-title">📋 Your Details</div>
            <div className="if-row">
              <div className="fg"><label>Full Name *</label><input placeholder="Full name" value={bForm.name} onChange={e=>bf("name",e.target.value)} /></div>
              <div className="fg"><label>Phone Number *</label><input placeholder="+264 81 XXX XXXX" value={bForm.phone} onChange={e=>bf("phone",e.target.value)} /></div>
            </div>
            <div className="if-row">
              <div className="fg"><label>Email</label><input type="email" placeholder="your@email.com" value={bForm.email} onChange={e=>bf("email",e.target.value)} /></div>
              <div className="fg"><label>Company / Organisation</label><input placeholder="Company name" value={bForm.company} onChange={e=>bf("company",e.target.value)} /></div>
            </div>
            <div className="if-row">
              <div className="fg"><label>ID Number / Company Reg</label><input placeholder="Namibian ID or CC/Reg No." value={bForm.idNumber} onChange={e=>bf("idNumber",e.target.value)} /></div>
              <div className="fg"><label>VAT Number (if applicable)</label><input placeholder="VAT registration number" value={bForm.vatNumber} onChange={e=>bf("vatNumber",e.target.value)} /></div>
            </div>
            <div className="fg" style={{marginBottom:16}}>
              <label>Special Requirements / Site Notes</label>
              <textarea rows={2} placeholder="Operator needed? Site access? Specific attachments required?" value={bForm.notes} onChange={e=>bf("notes",e.target.value)} />
            </div>
            <button className="btn-primary" style={{width:"100%",justifyContent:"center",padding:"13px",opacity:canProceedToAgreement?1:.5}}
              onClick={() => { if(!canProceedToAgreement){alert("Please fill in your name and phone, and select valid dates.");return;} setStep("agreement"); setTimeout(()=>agreeRef.current?.scrollIntoView({behavior:"smooth"}),100); }}>
              Next: Review & Sign Agreement →
            </button>
            <p style={{fontSize:11,color:"var(--bark)",marginTop:8,textAlign:"center"}}>You will review and sign the hire agreement in the next step.</p>
          </div>
        </>
      )}

      {/* STEP 2 — AGREEMENT */}
      {step === "agreement" && (
        <div ref={agreeRef}>
          <div style={{background:"rgba(232,146,12,.08)",border:"1px solid var(--dune)",borderRadius:3,padding:"10px 14px",marginBottom:14,fontSize:12,color:"var(--sand)",lineHeight:1.6}}>
            📄 Please read the full Plant Hire Agreement below carefully before signing. <strong style={{color:"var(--horizon)"}}>Scroll to read all terms.</strong>
          </div>

          <HireAgreementText listing={listing} bForm={bForm} startDate={startDate} endDate={endDate} days={days} totalCost={totalCost} />

          <div className="agreement-footer">
            <div style={{fontFamily:"Oswald,sans-serif",fontSize:14,color:"var(--ivory)",letterSpacing:"1px",marginBottom:14}}>CONFIRMATION &amp; ELECTRONIC SIGNATURE</div>

            <div className="agree-checkbox-row">
              <input type="checkbox" id="ag1" checked={agreedTerms} onChange={e=>setAgreedTerms(e.target.checked)} />
              <label htmlFor="ag1">I confirm I have read and understood all <strong>14 sections</strong> of this Plant Hire Agreement and agree to be bound by all terms and conditions.</label>
            </div>
            <div className="agree-checkbox-row">
              <input type="checkbox" id="ag2" checked={agreedDeposit} onChange={e=>setAgreedDeposit(e.target.checked)} />
              <label htmlFor="ag2">I confirm that a <strong>50% deposit of N$ {deposit.toLocaleString()}</strong> is due before equipment dispatch and the balance is due within 7 days of equipment return.</label>
            </div>
            <div className="agree-checkbox-row">
              <input type="checkbox" id="ag3" checked={agreedInsurance} onChange={e=>setAgreedInsurance(e.target.checked)} />
              <label htmlFor="ag3">I confirm that <strong>adequate insurance</strong> covering equipment damage, loss, and third-party liability will be in place for the full hire period, and that I am fully liable for any uninsured losses.</label>
            </div>
            <div className="agree-checkbox-row">
              <input type="checkbox" id="ag4" checked={agreedOperator} onChange={e=>setAgreedOperator(e.target.checked)} />
              <label htmlFor="ag4">I confirm that only <strong>qualified, licensed operators</strong> will operate this equipment and that we will comply with all applicable Namibian health and safety laws.</label>
            </div>

            <div className="sig-row" style={{marginTop:16}}>
              <div className="sig-box">
                <div className="sig-label">Lessee Signature (type full name)</div>
                <input className="sig-input" placeholder="Type your full name to sign..." value={sigName} onChange={e=>setSigName(e.target.value)} />
                <div style={{fontSize:10,color:"var(--bark)",marginTop:6}}>Electronic signature — {sigDate}</div>
              </div>
              <div className="sig-box">
                <div className="sig-label">For and on behalf of BLC Suppliers &amp; Trading</div>
                <div style={{fontFamily:"Lato,sans-serif",fontSize:14,fontStyle:"italic",color:"var(--ivory)",borderBottom:"1px solid var(--clay)",paddingBottom:4,marginBottom:4}}>Bertus Christiaan</div>
                <div style={{fontSize:10,color:"var(--bark)"}}>Managing Director · CC/2017/00361</div>
              </div>
            </div>

            <button className="btn-primary" style={{width:"100%",justifyContent:"center",padding:"14px",marginTop:4,opacity:canSubmit?1:.45}}
              onClick={submitBooking}>
              ✅ I Accept — Submit Booking Request
            </button>
            {!canSubmit && <p style={{fontSize:11,color:"var(--bark)",marginTop:8,textAlign:"center"}}>Please tick all checkboxes and type your full name to enable submission.</p>}
            <button className="btn-outline" style={{width:"100%",justifyContent:"center",padding:"10px",marginTop:8}} onClick={()=>setStep("calendar")}>← Back to Details</button>
          </div>
        </div>
      )}

      {!startDate && step === "calendar" && (
        <div style={{textAlign:"center",padding:"14px",fontSize:13,color:"var(--bark)"}}>
          👆 Tap a start date on the calendar above, then tap an end date
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN BOOKINGS PANEL
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// QUOTE GENERATOR
// ─────────────────────────────────────────────────────────────────────────────
function genQuoteRef(bookingId) {
  const num = bookingId.replace("bk_","").slice(-6);
  return `BLC-Q${num}`;
}

function buildQuoteEmail(b, quoteRef) {
  const fmtD = d => new Date(d).toLocaleDateString("en-NA",{day:"numeric",month:"long",year:"numeric"});
  const vatRate = 0.15;
  const subtotal = b.totalCost || 0;
  const vat = Math.ceil(subtotal * vatRate);
  const total = subtotal + vat;
  const deposit = b.deposit || Math.ceil(subtotal * 0.5);

  const subject = `Booking Confirmed & Quotation ${quoteRef} — ${b.listingName}`;
  const body = `Dear ${b.bookedBy?.name},

Thank you for your booking through BLC Plant Hire.

Your booking has been CONFIRMED and a formal quotation is provided below.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BLC SUPPLIERS AND TRADING
CC/2017/00361 | Rosh Pinah, Namibia
Tel: +264 81 603 4139
Email: blc.bertus@gmail.com
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FORMAL QUOTATION
Quote Reference: ${quoteRef}
Quote Date: ${fmtD(Date.now())}
Valid Until: ${fmtD(Date.now() + 7*86400000)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BILL TO:
${b.bookedBy?.name}
${b.bookedBy?.company ? b.bookedBy.company + "\n" : ""}${b.bookedBy?.phone}
${b.bookedBy?.email || ""}
${b.bookedBy?.idNumber ? "ID/Reg: " + b.bookedBy.idNumber : ""}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EQUIPMENT DETAILS:
Equipment:    ${b.listingName}
Hire Period:  ${fmtD(b.startDate)} to ${fmtD(b.endDate)}
Duration:     ${b.days} day${b.days !== 1 ? "s" : ""}
Rate:         N$ ${(b.totalCost / b.days).toLocaleString()} per ${b.unit}
${b.bookedBy?.notes ? "Notes:        " + b.bookedBy.notes : ""}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRICING SUMMARY:
Subtotal (excl. VAT):   N$ ${subtotal.toLocaleString()}
VAT (15%):              N$ ${vat.toLocaleString()}
TOTAL (incl. VAT):      N$ ${total.toLocaleString()}

DEPOSIT DUE (50%):      N$ ${deposit.toLocaleString()}
BALANCE DUE:            N$ ${(total - deposit).toLocaleString()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PAYMENT DETAILS:
Bank:         Bank Windhoek
Account Name: BLC Suppliers and Trading
Account No:   8052167764
Branch Code:  486-372 (Capricon Branch)
Reference:    ${quoteRef}

IMPORTANT: Please use quote reference ${quoteRef} as your payment reference.
Deposit of N$ ${deposit.toLocaleString()} is due BEFORE equipment dispatch.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TERMS & CONDITIONS:
• This quotation is valid for 7 days from the quote date.
• Equipment will be dispatched upon receipt of the 50% deposit.
• Balance is due within 7 days of equipment return.
• The hire agreement signed during booking remains binding.
• BLC reserves the right to withdraw this quote if availability changes.
• All amounts in Namibian Dollars (N$) inclusive of VAT at 15%.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
To confirm, please pay the deposit and send proof of payment to:
blc.bertus@gmail.com or WhatsApp +264 81 603 4139

Thank you for choosing BLC Plant Hire — Namibia.

Bertus Christiaan
Managing Director
BLC Suppliers and Trading
CC/2017/00361`;

  return { subject, body };
}

function QuoteModal({ booking, onClose, onMarkQuoteSent }) {
  if (!booking) return null;
  const quoteRef = genQuoteRef(booking.id);
  const fmtD = d => new Date(d).toLocaleDateString("en-NA",{day:"numeric",month:"long",year:"numeric"});
  const vatRate = 0.15;
  const subtotal = booking.totalCost || 0;
  const vat = Math.ceil(subtotal * vatRate);
  const total = subtotal + vat;
  const deposit = booking.deposit || Math.ceil(subtotal * 0.5);
  const balance = total - deposit;
  const validUntil = fmtD(Date.now() + 7*86400000);
  const { subject, body } = buildQuoteEmail(booking, quoteRef);

  const mailtoLink = `mailto:${booking.bookedBy?.email || ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const waText = `Hi ${booking.bookedBy?.name}, your booking for ${booking.listingName} has been confirmed. Quote Ref: ${quoteRef}. Total: N$${total.toLocaleString()} (incl. VAT). Deposit due: N$${deposit.toLocaleString()} to BLC Bank Windhoek acc 8052167764. Ref: ${quoteRef}. Full quote sent to your email.`;
  const waLink = `https://wa.me/${(booking.bookedBy?.phone||"").replace(/\D/g,"")}?text=${encodeURIComponent(waText)}`;

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:720,padding:0,overflow:"hidden"}}>
        {/* Quote header */}
        <div style={{background:"var(--clay)",padding:"20px 28px",borderBottom:"1px solid var(--dune)",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
          <div>
            <div style={{fontFamily:"Oswald,sans-serif",fontSize:22,color:"var(--ivory)",letterSpacing:"2px"}}>FORMAL QUOTATION</div>
            <div style={{fontSize:12,color:"var(--sand)",marginTop:2}}>Quote Ref: <strong style={{color:"var(--horizon)"}}>{quoteRef}</strong> · Valid Until: {validUntil}</div>
          </div>
          <button className="modal-close" onClick={onClose} style={{position:"relative",top:"auto",right:"auto"}}>✕</button>
        </div>

        <div style={{overflowY:"auto",maxHeight:"75vh",padding:"0 28px 28px"}}>
          {/* Company & client */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,margin:"20px 0",padding:"16px",background:"var(--soil)",border:"1px solid var(--clay)",borderRadius:4}}>
            <div>
              <div style={{fontSize:9,fontWeight:700,letterSpacing:"2px",textTransform:"uppercase",color:"var(--dune)",marginBottom:6}}>From</div>
              <div style={{fontFamily:"Oswald,sans-serif",fontSize:15,color:"var(--horizon)",letterSpacing:"1px",marginBottom:4}}>BLC SUPPLIERS AND TRADING</div>
              <div style={{fontSize:12,color:"var(--sand)",lineHeight:1.7}}>CC/2017/00361<br/>Rosh Pinah, Namibia<br/>+264 81 603 4139<br/>blc.bertus@gmail.com</div>
            </div>
            <div>
              <div style={{fontSize:9,fontWeight:700,letterSpacing:"2px",textTransform:"uppercase",color:"var(--dune)",marginBottom:6}}>Bill To</div>
              <div style={{fontFamily:"Oswald,sans-serif",fontSize:15,color:"var(--ivory)",letterSpacing:"0.5px",marginBottom:4}}>{booking.bookedBy?.name}</div>
              <div style={{fontSize:12,color:"var(--sand)",lineHeight:1.7}}>
                {booking.bookedBy?.company && <>{booking.bookedBy.company}<br/></>}
                {booking.bookedBy?.phone}<br/>
                {booking.bookedBy?.email && <>{booking.bookedBy.email}<br/></>}
                {booking.bookedBy?.idNumber && <>ID/Reg: {booking.bookedBy.idNumber}</>}
              </div>
            </div>
          </div>

          {/* Equipment & dates */}
          <div style={{background:"var(--earth)",border:"1px solid var(--clay)",borderRadius:4,overflow:"hidden",marginBottom:16}}>
            <div style={{background:"var(--clay)",padding:"8px 16px",fontSize:9,fontWeight:700,letterSpacing:"2px",textTransform:"uppercase",color:"var(--horizon)"}}>Equipment &amp; Hire Details</div>
            <div style={{padding:"14px 16px"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead>
                  <tr style={{borderBottom:"1px solid var(--clay)"}}>
                    {["Description","Start Date","End Date","Days","Rate","Amount"].map(h=>(
                      <th key={h} style={{textAlign:"left",padding:"6px 8px",fontSize:9,fontWeight:700,letterSpacing:"1.5px",textTransform:"uppercase",color:"var(--dune)"}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{padding:"10px 8px",color:"var(--dust)",fontWeight:700,fontSize:13}}>{booking.listingName}</td>
                    <td style={{padding:"10px 8px",color:"var(--dust)",fontSize:12}}>{fmtD(booking.startDate)}</td>
                    <td style={{padding:"10px 8px",color:"var(--dust)",fontSize:12}}>{fmtD(booking.endDate)}</td>
                    <td style={{padding:"10px 8px",color:"var(--dust)",fontSize:12}}>{booking.days}</td>
                    <td style={{padding:"10px 8px",color:"var(--dust)",fontSize:12}}>N$ {(subtotal/booking.days).toLocaleString()}/{booking.unit}</td>
                    <td style={{padding:"10px 8px",color:"var(--horizon)",fontFamily:"Oswald,sans-serif",fontSize:15,fontWeight:700}}>N$ {subtotal.toLocaleString()}</td>
                  </tr>
                  {booking.bookedBy?.notes && (
                    <tr>
                      <td colSpan={6} style={{padding:"6px 8px",color:"var(--sand)",fontSize:11,fontStyle:"italic",borderTop:"1px solid var(--clay)"}}>Notes: {booking.bookedBy.notes}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pricing summary */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
            <div style={{background:"var(--soil)",border:"1px solid var(--clay)",borderRadius:4,padding:"14px 16px"}}>
              <div style={{fontSize:9,fontWeight:700,letterSpacing:"2px",textTransform:"uppercase",color:"var(--dune)",marginBottom:10}}>Payment Schedule</div>
              {[
                ["Subtotal (excl. VAT)", `N$ ${subtotal.toLocaleString()}`, "var(--dust)"],
                ["VAT (15%)", `N$ ${vat.toLocaleString()}`, "var(--dust)"],
                ["Total (incl. VAT)", `N$ ${total.toLocaleString()}`, "var(--horizon)"],
                ["Deposit Due (50%)", `N$ ${deposit.toLocaleString()}`, "var(--teal-light)"],
                ["Balance Due", `N$ ${balance.toLocaleString()}`, "var(--sand)"],
              ].map(([l,v,c])=>(
                <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid rgba(61,41,16,.4)"}}>
                  <span style={{fontSize:11,color:"var(--sand)"}}>{l}</span>
                  <span style={{fontFamily:"Oswald,sans-serif",fontSize:14,color:c,fontWeight:700}}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{background:"var(--soil)",border:"1px solid var(--clay)",borderRadius:4,padding:"14px 16px"}}>
              <div style={{fontSize:9,fontWeight:700,letterSpacing:"2px",textTransform:"uppercase",color:"var(--dune)",marginBottom:10}}>Bank Details</div>
              {[["Bank","Bank Windhoek"],["Account","BLC Suppliers and Trading"],["Acc No","8052167764"],["Branch","486-372 (Capricon)"],["Reference",quoteRef]].map(([l,v])=>(
                <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid rgba(61,41,16,.4)"}}>
                  <span style={{fontSize:11,color:"var(--sand)"}}>{l}</span>
                  <span style={{fontSize:12,color:l==="Reference"?"var(--horizon)":"var(--dust)",fontWeight:l==="Reference"?700:400}}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Terms */}
          <div style={{background:"rgba(232,146,12,.06)",border:"1px solid var(--dune)",borderRadius:4,padding:"13px 16px",marginBottom:20,fontSize:11,color:"var(--sand)",lineHeight:1.7}}>
            <strong style={{color:"var(--horizon)"}}>Terms:</strong> Valid 7 days · Deposit due before dispatch · Balance due within 7 days of return · VAT at 15% · Hire agreement signed during booking remains binding · Equipment dispatched upon proof of deposit payment.
          </div>

          {/* Signature line */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
            <div style={{borderTop:"1px solid var(--clay)",paddingTop:10}}>
              <div style={{fontFamily:"Lato,sans-serif",fontSize:14,fontStyle:"italic",color:"var(--ivory)",marginBottom:4}}>Bertus Christiaan</div>
              <div style={{fontSize:10,color:"var(--bark)"}}>Managing Director · BLC Suppliers and Trading</div>
              <div style={{fontSize:10,color:"var(--bark)"}}>CC/2017/00361 · {fmtD(Date.now())}</div>
            </div>
            <div style={{borderTop:"1px solid var(--clay)",paddingTop:10}}>
              <div style={{fontSize:12,color:"var(--dust)",fontStyle:"italic",marginBottom:4}}>{booking.signature || booking.bookedBy?.name}</div>
              <div style={{fontSize:10,color:"var(--bark)"}}>Hirer · Agreement accepted electronically</div>
              <div style={{fontSize:10,color:"var(--bark)"}}>{booking.agreementDate ? fmtD(booking.agreementDate) : ""}</div>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            {booking.bookedBy?.email && (
              <a href={mailtoLink} className="btn-primary" style={{textDecoration:"none",display:"inline-flex",alignItems:"center",gap:6}}
                onClick={()=>onMarkQuoteSent(booking.id)}>
                ✉ Send Quote by Email
              </a>
            )}
            <a href={waLink} target="_blank" rel="noreferrer" className="btn-sale" style={{textDecoration:"none",display:"inline-flex",alignItems:"center",gap:6,background:"#25d366"}}
              onClick={()=>onMarkQuoteSent(booking.id)}>
              💬 Send via WhatsApp
            </a>
            <button className="btn-primary" onClick={()=>{
              const w=window.open("","_blank");
              w.document.write(`<pre style="font-family:monospace;font-size:13px;padding:20px;white-space:pre-wrap">${body}</pre>`);
              w.document.title=`Quote ${quoteRef}`;
              w.print();
              onMarkQuoteSent(booking.id);
            }}>🖨 Print / Save PDF</button>
            <button className="btn-outline" onClick={onClose}>Close</button>
          </div>

          {booking.quoteSent && (
            <div style={{marginTop:14,padding:"8px 12px",background:"rgba(46,125,50,.12)",border:"1px solid var(--green-ok)",borderRadius:3,fontSize:11,color:"#81c784"}}>
              ✅ Quote {quoteRef} marked as sent · {booking.quoteSentAt ? new Date(booking.quoteSentAt).toLocaleString("en-NA") : ""}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminBookingsPanel({ bookings, setBookings, listings }) {
  const [filter, setFilter] = useState("all");
  const [quoteBooking, setQuoteBooking] = useState(null);

  const pending   = bookings.filter(b => b.status === "pending");
  const confirmed = bookings.filter(b => b.status === "confirmed");
  const cancelled = bookings.filter(b => b.status === "cancelled");
  const display   = filter === "pending" ? pending : filter === "confirmed" ? confirmed : filter === "cancelled" ? cancelled : bookings;

  const confirmAndQuote = (id) => {
    const u = bookings.map(b => b.id===id ? {...b, status:"confirmed", confirmedAt:Date.now()} : b);
    setBookings(u); saveBookings(u);
    const confirmed = u.find(b => b.id===id);
    setQuoteBooking(confirmed);
    // Auto-queue SMS to customer
    if (confirmed.bookedBy?.phone) {
      queueSms(confirmed.bookedBy.phone, SMS_TEMPLATES.booking_confirmed(confirmed), "booking_confirmed");
    }
  };

  const updateStatus = (id, status) => {
    const u = bookings.map(b => b.id===id ? {...b,status} : b);
    setBookings(u); saveBookings(u);
    const b = u.find(x => x.id===id);
    if (status === "cancelled" && b?.bookedBy?.phone) {
      queueSms(b.bookedBy.phone, SMS_TEMPLATES.booking_cancelled(b), "booking_cancelled");
    }
  };

  const markQuoteSent = (id) => {
    const u = bookings.map(b => b.id===id ? {...b, quoteSent:true, quoteSentAt:Date.now(), quoteRef:genQuoteRef(id)} : b);
    setBookings(u); saveBookings(u);
  };

  const fmtDate = d => new Date(d).toLocaleDateString("en-NA",{day:"numeric",month:"short",year:"numeric"});
  const fmt = ts => new Date(ts).toLocaleString("en-NA",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});

  return (
    <>
      <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:20,flexWrap:"wrap"}}>
        <div style={{fontFamily:"Oswald,sans-serif",fontSize:22,letterSpacing:"1.5px",color:"var(--ivory)"}}>BOOKINGS</div>
        {pending.length > 0 && <span style={{background:"#ef4444",color:"#fff",padding:"2px 10px",borderRadius:10,fontSize:11,fontWeight:700}}>{pending.length} awaiting confirmation</span>}
        <div style={{display:"flex",gap:8,marginLeft:"auto",flexWrap:"wrap"}}>
          {[["all",bookings],["pending",pending],["confirmed",confirmed],["cancelled",cancelled]].map(([t,arr]) => (
            <button key={t} className={`admin-tab${filter===t?" active":""}`} onClick={()=>setFilter(t)}>
              {t.charAt(0).toUpperCase()+t.slice(1)} <span className="bc">{arr.length}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div className="revenue-summary" style={{marginBottom:20}}>
        <div className="rev-item"><div className="rev-num">{bookings.length}</div><div className="rev-label">Total Bookings</div></div>
        <div className="rev-item"><div className="rev-num" style={{color:"var(--horizon)"}}>{pending.length}</div><div className="rev-label">Pending</div></div>
        <div className="rev-item"><div className="rev-num green">{confirmed.length}</div><div className="rev-label">Confirmed</div></div>
        <div className="rev-item"><div className="rev-num green">N${confirmed.reduce((s,b)=>s+(b.totalCost||0),0).toLocaleString()}</div><div className="rev-label">Confirmed Revenue</div></div>
      </div>

      {display.length === 0 ? (
        <div className="empty"><div className="empty-icon">📅</div><h3>No {filter==="all"?"":filter} bookings yet</h3><p>Booking requests from users will appear here.</p></div>
      ) : (
        display.slice().reverse().map(b => (
          <div key={b.id} className={`booking-card ${b.status}-b`}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:8,marginBottom:10}}>
              <div>
                <span className={`booking-status bs-${b.status}`}>{b.status.toUpperCase()}</span>
                <div style={{fontFamily:"Oswald,sans-serif",fontSize:16,color:"var(--ivory)",marginTop:4}}>{b.listingName}</div>
                <div style={{fontSize:11,color:"var(--bark)",marginTop:2}}>Submitted: {fmt(b.submittedAt)}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontFamily:"Oswald,sans-serif",fontSize:22,color:"var(--horizon)"}}>N$ {(b.totalCost||0).toLocaleString()}</div>
                <div style={{fontSize:11,color:"var(--sand)"}}>{b.days} day{b.days!==1?"s":""} · per {b.unit}</div>
              </div>
            </div>

            {/* Dates */}
            <div style={{background:"var(--soil)",padding:"10px 14px",borderRadius:3,border:"1px solid var(--clay)",marginBottom:10,display:"flex",gap:20,flexWrap:"wrap"}}>
              <div><div style={{fontSize:9,color:"var(--dune)",letterSpacing:"1.5px",textTransform:"uppercase",marginBottom:2}}>Start Date</div><div style={{fontWeight:700,color:"var(--dust)"}}>{fmtDate(b.startDate)}</div></div>
              <div><div style={{fontSize:9,color:"var(--dune)",letterSpacing:"1.5px",textTransform:"uppercase",marginBottom:2}}>End Date</div><div style={{fontWeight:700,color:"var(--dust)"}}>{fmtDate(b.endDate)}</div></div>
              <div><div style={{fontSize:9,color:"var(--dune)",letterSpacing:"1.5px",textTransform:"uppercase",marginBottom:2}}>Duration</div><div style={{fontWeight:700,color:"var(--dust)"}}>{b.days} day{b.days!==1?"s":""}</div></div>
            </div>

            {/* Booker contact — admin only */}
            <div className="lead-contact" style={{marginBottom:10}}>
              <p>👤 <strong>{b.bookedBy?.name}</strong>{b.bookedBy?.company ? ` — ${b.bookedBy.company}` : ""}</p>
              {b.bookedBy?.idNumber && <p>🪪 ID/Reg: <strong>{b.bookedBy.idNumber}</strong></p>}
              <p>📞 <a href={`tel:${b.bookedBy?.phone}`}>{b.bookedBy?.phone}</a></p>
              {b.bookedBy?.email && <p>✉ <a href={`mailto:${b.bookedBy?.email}`} style={{color:"var(--teal-light)"}}>{b.bookedBy?.email}</a></p>}
              {b.bookedBy?.notes && <p style={{color:"var(--sand)",fontStyle:"italic",marginTop:4}}>"{b.bookedBy.notes}"</p>}
            </div>
            {/* Agreement status */}
            {b.agreementAccepted && (
              <div style={{background:"rgba(46,125,50,.1)",border:"1px solid var(--green-ok)",borderRadius:3,padding:"8px 12px",marginBottom:10,fontSize:11,color:"#81c784",display:"flex",gap:12,flexWrap:"wrap"}}>
                <span>✅ Agreement accepted</span>
                {b.signature && <span>✍ Signed: <strong style={{color:"var(--ivory)"}}>{b.signature}</strong></span>}
                {b.agreementDate && <span>📅 {new Date(b.agreementDate).toLocaleDateString("en-NA")}</span>}
                <span>💰 Deposit due: <strong>N$ {(b.deposit||0).toLocaleString()}</strong></span>
              </div>
            )}

            <div className="action-btns">
              {b.status !== "confirmed" && (
                <button className="btn-approve" onClick={() => confirmAndQuote(b.id)}>
                  ✓ Confirm & Generate Quote
                </button>
              )}
              {b.status === "confirmed" && (
                <button className="btn-primary" style={{padding:"5px 12px",fontSize:10}} onClick={() => setQuoteBooking(b)}>
                  📄 {b.quoteSent ? "View Sent Quote" : "View & Send Quote"}
                </button>
              )}
              {b.status !== "cancelled" && <button className="btn-reject" onClick={() => updateStatus(b.id,"cancelled")}>✕ Cancel</button>}
              <a href={`tel:${b.bookedBy?.phone}`} className="btn-primary" style={{textDecoration:"none",display:"inline-flex",alignItems:"center",gap:5,padding:"5px 12px",fontSize:10}}>📞 Call</a>
              {b.bookedBy?.email && <a href={`mailto:${b.bookedBy?.email}?subject=Booking Confirmation: ${encodeURIComponent(b.listingName)}`} className="btn-outline" style={{textDecoration:"none",display:"inline-flex",alignItems:"center",gap:5,padding:"5px 12px",fontSize:10}}>✉ Email</a>}
            </div>

            {/* Quote sent status */}
            {b.status === "confirmed" && (
              <div style={{marginTop:10,padding:"7px 12px",background:b.quoteSent?"rgba(46,125,50,.1)":"rgba(232,146,12,.08)",border:`1px solid ${b.quoteSent?"var(--green-ok)":"var(--dune)"}`,borderRadius:3,fontSize:11,color:b.quoteSent?"#81c784":"var(--sand)",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
                <span>{b.quoteSent ? `✅ Quote ${b.quoteRef||genQuoteRef(b.id)} sent · ${b.quoteSentAt?new Date(b.quoteSentAt).toLocaleDateString("en-NA"):""}` : "⚠ Quote not yet sent — click View &amp; Send Quote"}</span>
                {!b.quoteSent && <button className="btn-primary" style={{padding:"4px 12px",fontSize:10}} onClick={()=>setQuoteBooking(b)}>Send Now →</button>}
              </div>
            )}
          </div>
        ))
      )}
      {quoteBooking && (
        <QuoteModal
          booking={quoteBooking}
          onClose={() => setQuoteBooking(null)}
          onMarkQuoteSent={markQuoteSent}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AD COMPONENTS  — 2-minute rotation with fade
// ─────────────────────────────────────────────────────────────────────────────

const ROTATION_MS = 120000; // 2 minutes

// Shared rotation hook — rotates every 2 min, returns current ad + progress 0-100
function useAdRotation(active) {
  const [idx, setIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const startRef = useRef(Date.now());
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (active.length <= 1) { setProgress(0); return; }
    startRef.current = Date.now();
    setProgress(0);

    // Progress ticker — updates every second
    const ticker = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      setProgress(Math.min(100, (elapsed / ROTATION_MS) * 100));
    }, 1000);

    // Rotation — fade out, switch, fade in
    const rotator = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx(i => (i + 1) % active.length);
        setProgress(0);
        startRef.current = Date.now();
        setVisible(true);
      }, 400);
    }, ROTATION_MS);

    return () => { clearInterval(ticker); clearInterval(rotator); };
  }, [active.length, active.map(a=>a.id).join(",")]);

  return { ad: active[idx % Math.max(active.length, 1)], idx, visible, progress };
}

// Countdown ring component
function RotationCountdown({ progress, color, size = 18 }) {
  if (!progress) return null;
  const r = (size - 4) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ - (progress / 100) * circ;
  return (
    <svg width={size} height={size} style={{transform:"rotate(-90deg)",flexShrink:0}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="2.5" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color||"rgba(255,255,255,.6)"} strokeWidth="2.5"
        strokeDasharray={circ} strokeDashoffset={dash} strokeLinecap="round" style={{transition:"stroke-dashoffset 1s linear"}} />
    </svg>
  );
}

function AdHeroBanner({ ads }) {
  const active = activeAds(ads, "hero_banner");
  const { ad, idx, visible, progress } = useAdRotation(active);
  if (!active.length) return null;
  return (
    <a href={ad.link||"#"} target="_blank" rel="noreferrer" style={{textDecoration:"none",display:"block"}}
      onClick={e => { if (ad.link==="#") e.preventDefault(); }}>
      <div style={{
        background:`linear-gradient(135deg, ${ad.bgColor||"#0d2137"} 0%, ${ad.bgColor||"#0d2137"}cc 100%)`,
        borderTop:`3px solid ${ad.textColor||"#f0c040"}`,
        borderBottom:`3px solid ${ad.textColor||"#f0c040"}33`,
        minHeight:72, position:"relative", overflow:"hidden",
        opacity:visible?1:0, transition:"opacity 0.4s ease",
        boxShadow:`inset 0 0 60px ${ad.textColor||"#f0c040"}11`
      }}>
        {/* shimmer line */}
        <div style={{position:"absolute",top:0,left:0,right:0,height:1,background:`linear-gradient(90deg, transparent, ${ad.textColor||"#fff"}44, transparent)`}} />
        <span style={{position:"absolute",top:5,right:10,fontSize:9,color:ad.textColor||"#fff",opacity:.4,letterSpacing:"1.5px",textTransform:"uppercase"}}>Advertisement</span>
        {active.length>1&&<span style={{position:"absolute",top:5,left:10,fontSize:9,color:ad.textColor||"#fff",opacity:.45,letterSpacing:"1px"}}>{idx+1}/{active.length}</span>}
        {ad.image
          ? <img src={ad.image} alt={ad.advertiser} style={{width:"100%",height:72,objectFit:"cover"}} />
          : (
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 32px",gap:24}}>
              <div style={{display:"flex",alignItems:"center",gap:14}}>
                <div style={{width:4,height:40,background:ad.textColor||"#f0c040",borderRadius:2,flexShrink:0}} />
                <div>
                  <div style={{fontFamily:"Oswald,sans-serif",fontSize:18,fontWeight:700,color:ad.textColor||"#fff",letterSpacing:"1.5px",lineHeight:1.1}}>{ad.advertiser}</div>
                  <div style={{fontSize:12,color:ad.textColor||"#fff",opacity:.8,marginTop:3}}>{ad.tagline}</div>
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:16,flexShrink:0}}>
                {active.length>1&&<RotationCountdown progress={progress} color={ad.textColor||"#fff"} size={18} />}
                <div style={{padding:"8px 20px",border:`1.5px solid ${ad.textColor||"#fff"}`,borderRadius:3,fontSize:11,fontWeight:700,letterSpacing:"2px",textTransform:"uppercase",color:ad.textColor||"#fff",whiteSpace:"nowrap"}}>Learn More →</div>
              </div>
            </div>
          )
        }
        {active.length>1&&(
          <div style={{position:"absolute",bottom:5,left:"50%",transform:"translateX(-50%)",display:"flex",gap:5,alignItems:"center"}}>
            {active.map((_,i)=><div key={i} style={{width:i===idx?20:5,height:3,borderRadius:2,background:i===idx?(ad.textColor||"#fff"):"rgba(255,255,255,.25)",transition:"all .4s"}} />)}
          </div>
        )}
      </div>
    </a>
  );
}

function AdInlineCard({ ads }) {
  const active = activeAds(ads, "inline_card");
  const { ad, idx, visible, progress } = useAdRotation(active);
  if (!active.length) return null;
  return (
    <a href={ad.link||"#"} target="_blank" rel="noreferrer" style={{textDecoration:"none"}}
      onClick={e => { if (ad.link==="#") e.preventDefault(); }}>
      <div style={{
        background:`linear-gradient(160deg, ${ad.bgColor||"#051a10"} 0%, ${ad.bgColor||"#051a10"}dd 100%)`,
        border:`1.5px solid ${ad.textColor||"#22d498"}33`,
        borderLeft:`3px solid ${ad.textColor||"#22d498"}`,
        borderRadius:6, padding:"20px 18px", position:"relative", overflow:"hidden",
        opacity:visible?1:0, transition:"opacity 0.4s ease", cursor:"pointer",
        boxShadow:`0 0 24px ${ad.textColor||"#22d498"}0a`
      }}>
        <div style={{position:"absolute",top:0,right:0,width:60,height:60,background:`radial-gradient(circle, ${ad.textColor||"#22d498"}18, transparent)`,borderRadius:"50%"}} />
        <div style={{fontSize:8,fontWeight:700,letterSpacing:"2.5px",textTransform:"uppercase",color:ad.textColor||"#fff",opacity:.55,marginBottom:10,display:"flex",alignItems:"center",gap:6}}>
          📢 Sponsored {active.length>1&&<RotationCountdown progress={progress} color={ad.textColor||"#fff"} size={12} />}
        </div>
        <div style={{fontFamily:"Oswald,sans-serif",fontSize:16,fontWeight:700,color:ad.textColor||"#fff",letterSpacing:"1px",marginBottom:6,lineHeight:1.2}}>{ad.advertiser}</div>
        <div style={{fontSize:12,color:ad.textColor||"#fff",opacity:.8,lineHeight:1.55,marginBottom:14}}>{ad.tagline}</div>
        <div style={{display:"inline-flex",alignItems:"center",gap:6,padding:"6px 14px",border:`1px solid ${ad.textColor||"#fff"}55`,borderRadius:3,fontSize:10,fontWeight:700,letterSpacing:"1.5px",textTransform:"uppercase",color:ad.textColor||"#fff"}}>
          Find Out More →
        </div>
        {active.length>1&&<div style={{position:"absolute",bottom:10,right:12,display:"flex",gap:3}}>{active.map((_,i)=><div key={i} style={{width:i===idx?14:4,height:3,borderRadius:2,background:i===idx?(ad.textColor||"#fff"):"rgba(255,255,255,.25)",transition:"all .3s"}} />)}</div>}
      </div>
    </a>
  );
}

function AdFooterStrip({ ads }) {
  const active = activeAds(ads, "footer_strip");
  const { ad, idx, visible, progress } = useAdRotation(active);
  if (!active.length) return null;
  return (
    <a href={ad.link||"#"} target="_blank" rel="noreferrer" style={{textDecoration:"none",display:"block"}}
      onClick={e => { if (ad.link==="#") e.preventDefault(); }}>
      <div style={{
        background:`linear-gradient(90deg, ${ad.bgColor||"#030d1a"} 0%, ${ad.bgColor||"#030d1a"}ee 50%, ${ad.bgColor||"#030d1a"} 100%)`,
        borderTop:`2px solid ${ad.textColor||"#60b0ff"}33`,
        borderBottom:`2px solid ${ad.textColor||"#60b0ff"}22`,
        padding:"16px 40px", position:"relative",
        opacity:visible?1:0, transition:"opacity 0.4s ease"
      }}>
        <span style={{position:"absolute",top:4,right:12,fontSize:8,color:ad.textColor||"#fff",opacity:.35,letterSpacing:"1.5px",textTransform:"uppercase"}}>Advertisement</span>
        {ad.image
          ? <img src={ad.image} alt={ad.advertiser} style={{width:"100%",height:60,objectFit:"cover"}} />
          : (
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:28,flexWrap:"wrap"}}>
              <div style={{fontFamily:"Oswald,sans-serif",fontSize:17,fontWeight:700,color:ad.textColor||"#fff",letterSpacing:"2px"}}>{ad.advertiser}</div>
              <div style={{width:1,height:28,background:`${ad.textColor||"#fff"}33`}} />
              <div style={{fontSize:13,color:ad.textColor||"#fff",opacity:.85}}>{ad.tagline}</div>
              {active.length>1&&<RotationCountdown progress={progress} color={ad.textColor||"#fff"} size={16} />}
            </div>
          )
        }
      </div>
    </a>
  );
}

function AdModalSponsor({ ads }) {
  const active = activeAds(ads, "modal_sponsor");
  const { ad, idx, visible, progress } = useAdRotation(active);
  if (!active.length) return null;
  return (
    <a href={ad.link||"#"} target="_blank" rel="noreferrer" style={{textDecoration:"none"}}
      onClick={e => { if (ad.link==="#") e.preventDefault(); }}>
      <div style={{
        background:`linear-gradient(135deg, ${ad.bgColor||"#12042a"} 0%, ${ad.bgColor||"#12042a"}cc 100%)`,
        border:`1px solid ${ad.textColor||"#d09aff"}33`,
        borderLeft:`3px solid ${ad.textColor||"#d09aff"}`,
        borderRadius:4, padding:"12px 16px", marginTop:14,
        opacity:visible?1:0, transition:"opacity 0.4s ease", position:"relative"
      }}>
        <div style={{fontSize:8,fontWeight:700,letterSpacing:"2px",textTransform:"uppercase",color:ad.textColor||"#fff",opacity:.5,marginBottom:7,display:"flex",alignItems:"center",gap:6}}>
          💎 Sponsored Partner {active.length>1&&<><span>· {idx+1}/{active.length}</span><RotationCountdown progress={progress} color={ad.textColor||"#fff"} size={12} /></>}
        </div>
        {ad.image
          ? <img src={ad.image} alt={ad.advertiser} style={{height:40,objectFit:"contain",borderRadius:2}} />
          : (
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
              <div>
                <div style={{fontFamily:"Oswald,sans-serif",fontSize:14,color:ad.textColor||"#fff",fontWeight:700,letterSpacing:"1px"}}>{ad.advertiser}</div>
                <div style={{fontSize:11,color:ad.textColor||"#fff",opacity:.75,marginTop:2}}>{ad.tagline}</div>
              </div>
              <div style={{padding:"5px 12px",border:`1px solid ${ad.textColor||"#fff"}55`,borderRadius:2,fontSize:9,fontWeight:700,letterSpacing:"1.5px",textTransform:"uppercase",color:ad.textColor||"#fff",whiteSpace:"nowrap",flexShrink:0}}>Visit →</div>
            </div>
          )
        }
      </div>
    </a>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC — ADVERTISE WITH US PAGE
// ─────────────────────────────────────────────────────────────────────────────
const SLOT_ICONS = { hero_banner:"🏞", inline_card:"📋", footer_strip:"📰", modal_sponsor:"💎" };

function AdvertisePage({ onSubmitted }) {
  const [selectedSlot, setSelectedSlot] = useState("hero_banner");
  const [step, setStep] = useState("slots"); // slots | form | done
  const [form, setForm] = useState({ advertiser:"", contactName:"", phone:"", email:"", tagline:"", link:"", bgColor:"#1a2a3a", textColor:"#ffffff", startDate:"", endDate:"", image:"", months:1 });
  const [submitting, setSubmitting] = useState(false);
  const imgRef = useRef();
  const sf = (k,v) => setForm(f=>({...f,[k]:v}));
  const slot = AD_SLOTS[selectedSlot];
  const today = new Date().toISOString().split("T")[0];
  const calcEnd = () => { if(!form.startDate) return ""; const d=new Date(form.startDate); d.setMonth(d.getMonth()+parseInt(form.months||1)); return d.toISOString().split("T")[0]; };
  const totalCost = (slot?.price||0) * (form.months||1);

  const handleImg = (files) => {
    if(!files.length) return;
    const r=new FileReader(); r.onload=e=>sf("image",e.target.result); r.readAsDataURL(files[0]);
  };

  const submitAd = () => {
    if (!form.advertiser||!form.contactName||!form.phone||!form.email||!form.tagline||!form.startDate) {
      alert("Please fill in all required fields."); return;
    }
    setSubmitting(true);
    setTimeout(() => {
      const endDate = calcEnd();
      const all = loadAds();
      const newAd = {
        ...form, endDate, slot:selectedSlot,
        id:`ad_${Date.now()}`,
        active:false,
        adStatus:"pending",
        submittedAt:Date.now(),
      };
      saveAds([...all, newAd]);
      setSubmitting(false);
      setStep("done");
      onSubmitted && onSubmitted();
    }, 800);
  };

  if (step === "done") {
    return (
      <div className="advertise-page">
        <div className="ad-sub-success">
          <div style={{fontSize:40,marginBottom:14}}>📢✅</div>
          <div style={{fontFamily:"Oswald,sans-serif",fontSize:24,color:"#81c784",letterSpacing:"1.5px",marginBottom:10}}>Ad Submission Received!</div>
          <div style={{fontSize:14,color:"var(--dust)",lineHeight:1.8,marginBottom:20}}>
            Your advertising request for <strong style={{color:"var(--ivory)"}}>{form.advertiser}</strong> on the <strong style={{color:"var(--horizon)"}}>{slot?.label}</strong> has been submitted.<br/>
            BLC will review and contact you at <strong>{form.phone}</strong> or <strong>{form.email}</strong> within 24 hours to confirm payment and go-live date.
          </div>
          <div style={{background:"rgba(232,146,12,.1)",border:"1px solid var(--dune)",borderRadius:4,padding:"14px 18px",marginBottom:20,fontSize:13,color:"var(--sand)",lineHeight:1.7,textAlign:"left"}}>
            <strong style={{color:"var(--horizon)"}}>Next step — Payment:</strong><br/>
            Transfer <strong>N$ {totalCost.toLocaleString()}</strong> ({form.months} month{form.months>1?"s":""}) to:<br/>
            Bank Windhoek · BLC Suppliers and Trading · Acc: 8052167764 · Branch: 486-372<br/>
            Reference: <strong>ADVERT-{form.advertiser.split(" ")[0].toUpperCase()}</strong>
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
            <a href={`mailto:blc.bertus@gmail.com?subject=Ad Payment — ${form.advertiser}&body=Hi BLC,%0D%0A%0D%0AI have submitted an ad request for ${form.advertiser} on the ${slot?.label} slot.%0D%0AAttached is my proof of payment for N$ ${totalCost.toLocaleString()}.%0D%0A%0D%0AKind regards,%0D%0A${form.contactName}`} className="btn-primary" style={{textDecoration:"none",display:"inline-flex",alignItems:"center",gap:6}}>✉ Email Proof of Payment</a>
            <a href={`https://wa.me/264816034139?text=${encodeURIComponent(`Hi BLC, I submitted an ad for ${form.advertiser} on the ${slot?.label}. Sending proof of payment for N$ ${totalCost}.`)}`} target="_blank" rel="noreferrer" style={{textDecoration:"none",display:"inline-flex",alignItems:"center",gap:6,padding:"13px 24px",background:"#25d366",color:"#fff",borderRadius:3,fontWeight:700,fontSize:13,letterSpacing:"1px",textTransform:"uppercase"}}>💬 WhatsApp BLC</a>
          </div>
        </div>
      </div>
    );
  }

  if (step === "slots") return (
    <div className="advertise-page">
      <div className="advertise-hero">
        <h1>ADVERTISE ON <span>BLC PLANT HIRE</span></h1>
        <p>Reach Namibia's construction, mining, and civil engineering community. Unlimited advertisers per slot — your ad rotates every 2 minutes alongside other brands.</p>
        <div style={{display:"flex",gap:16,justifyContent:"center",flexWrap:"wrap",marginBottom:8}}>
          {["✅ No agency fees","✅ Direct to decision-makers","✅ All 14 Namibian regions","✅ Live within 24hrs"].map(t=>(
            <span key={t} style={{fontSize:12,color:"var(--teal-light)",fontWeight:700}}>{t}</span>
          ))}
        </div>
      </div>

      <div style={{fontFamily:"Oswald,sans-serif",fontSize:20,letterSpacing:"1.5px",color:"var(--ivory)",marginBottom:16}}>CHOOSE YOUR AD SLOT</div>
      <div className="slot-cards">
        {Object.values(AD_SLOTS).map(sl=>(
          <div key={sl.id} className={`slot-pick-card${selectedSlot===sl.id?" sel":""}`} onClick={()=>setSelectedSlot(sl.id)}>
            <div className="slot-pick-icon">{SLOT_ICONS[sl.id]||"📢"}</div>
            <div className="slot-pick-name">{sl.label}</div>
            <div className="slot-pick-price">N${sl.price}/month</div>
            <div className="slot-pick-desc">{sl.desc}</div>
          </div>
        ))}
      </div>

      <div style={{background:"var(--earth)",border:`2px solid var(--horizon)`,borderRadius:6,padding:"20px 24px",marginBottom:28}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
          <div>
            <div style={{fontFamily:"Oswald,sans-serif",fontSize:18,color:"var(--ivory)"}}>{SLOT_ICONS[selectedSlot]} {slot?.label}</div>
            <div style={{fontSize:12,color:"var(--sand)",marginTop:3}}>{slot?.desc}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontFamily:"Oswald,sans-serif",fontSize:28,color:"var(--horizon)"}}>N${slot?.price}<span style={{fontSize:12,color:"var(--sand)",fontFamily:"Lato"}}>/mo</span></div>
            <div style={{fontSize:11,color:"var(--bark)"}}>Unlimited advertisers · Rotates every 2 min</div>
          </div>
        </div>
      </div>

      <button className="btn-primary" style={{width:"100%",justifyContent:"center",padding:"16px",fontSize:14}} onClick={()=>setStep("form")}>
        Continue: Fill In Ad Details →
      </button>
    </div>
  );

  return (
    <div className="advertise-page">
      <div style={{fontFamily:"Oswald,sans-serif",fontSize:24,letterSpacing:"1.5px",color:"var(--ivory)",marginBottom:6}}>
        {SLOT_ICONS[selectedSlot]} BOOK YOUR AD — {slot?.label}
      </div>
      <div style={{fontSize:12,color:"var(--sand)",marginBottom:24}}>N${slot?.price}/month per advertiser · unlimited rotation · <button onClick={()=>setStep("slots")} style={{background:"none",border:"none",color:"var(--horizon)",cursor:"pointer",fontWeight:700,fontSize:12}}>← Change slot</button></div>

      <div className="form-card" style={{background:"var(--earth)",border:"1px solid var(--clay)",borderRadius:4,padding:32}}>
        {/* Contact details */}
        <div style={{fontSize:11,fontWeight:700,letterSpacing:"2px",textTransform:"uppercase",color:"var(--horizon)",marginBottom:12}}>Your Contact Details</div>
        <div className="form-row">
          <div className="fg"><label>Advertiser / Business Name *</label><input placeholder="e.g. Puma Energy Namibia" value={form.advertiser} onChange={e=>sf("advertiser",e.target.value)} /></div>
          <div className="fg"><label>Contact Person *</label><input placeholder="Full name" value={form.contactName} onChange={e=>sf("contactName",e.target.value)} /></div>
        </div>
        <div className="form-row">
          <div className="fg"><label>Phone Number *</label><input placeholder="+264 81 XXX XXXX" value={form.phone} onChange={e=>sf("phone",e.target.value)} /></div>
          <div className="fg"><label>Email Address *</label><input type="email" placeholder="contact@business.com" value={form.email} onChange={e=>sf("email",e.target.value)} /></div>
        </div>

        {/* Ad details */}
        <div style={{fontSize:11,fontWeight:700,letterSpacing:"2px",textTransform:"uppercase",color:"var(--horizon)",marginTop:20,marginBottom:12}}>Ad Content</div>
        <div className="form-row">
          <div className="fg"><label>Ad Tagline / Message *</label><input placeholder="Short memorable advertising message" value={form.tagline} onChange={e=>sf("tagline",e.target.value)} /></div>
          <div className="fg"><label>Website URL (optional)</label><input placeholder="https://yourwebsite.com" value={form.link} onChange={e=>sf("link",e.target.value)} /></div>
        </div>
        <div className="form-row">
          <div className="fg"><label>Background Color</label><div style={{display:"flex",gap:8,alignItems:"center"}}><input type="color" value={form.bgColor} onChange={e=>sf("bgColor",e.target.value)} style={{width:44,height:36,padding:2,border:"1px solid var(--clay)",borderRadius:2,background:"none",cursor:"pointer"}} /><input value={form.bgColor} onChange={e=>sf("bgColor",e.target.value)} style={{flex:1}} /></div></div>
          <div className="fg"><label>Text Color</label><div style={{display:"flex",gap:8,alignItems:"center"}}><input type="color" value={form.textColor} onChange={e=>sf("textColor",e.target.value)} style={{width:44,height:36,padding:2,border:"1px solid var(--clay)",borderRadius:2,background:"none",cursor:"pointer"}} /><input value={form.textColor} onChange={e=>sf("textColor",e.target.value)} style={{flex:1}} /></div></div>
        </div>

        {/* Ad image */}
        <div className="fg" style={{marginBottom:16}}>
          <label>Ad Banner Image (optional — replaces text layout)</label>
          <div className="img-upload-zone" onClick={()=>imgRef.current.click()} style={{padding:"16px",minHeight:56}}>
            {form.image ? <img src={form.image} alt="" style={{maxHeight:70,objectFit:"contain",borderRadius:3}} />
              : <><div className="up-icon" style={{fontSize:20,marginBottom:4}}>🖼</div><p>Click to upload banner image</p><small>JPG, PNG, WEBP</small></>}
            <input ref={imgRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleImg(e.target.files)} />
          </div>
          {form.image && <button className="btn-muted" style={{marginTop:6}} onClick={()=>sf("image","")}>✕ Remove</button>}
        </div>

        {/* Live preview */}
        <div style={{fontSize:10,fontWeight:700,letterSpacing:"2px",textTransform:"uppercase",color:"var(--horizon)",marginBottom:8}}>Live Preview</div>
        <div style={{border:"1px dashed var(--clay)",borderRadius:4,padding:8,background:"var(--soil)",marginBottom:20}}>
          {selectedSlot==="hero_banner"&&<div style={{background:form.bgColor,padding:"12px 24px",display:"flex",alignItems:"center",gap:20,borderRadius:3}}><div style={{fontFamily:"Oswald,sans-serif",fontSize:16,fontWeight:700,color:form.textColor}}>{form.advertiser||"Your Brand"}</div><div style={{flex:1,fontSize:12,color:form.textColor,textAlign:"center"}}>{form.tagline||"Your tagline here"}</div><div style={{fontSize:10,color:form.textColor,border:"1px solid currentColor",padding:"5px 12px",borderRadius:2}}>Learn More →</div></div>}
          {selectedSlot==="inline_card"&&<div style={{background:form.bgColor,padding:"16px",borderRadius:3,maxWidth:240}}><div style={{fontSize:9,color:form.textColor,opacity:.5,letterSpacing:"2px",textTransform:"uppercase",marginBottom:6}}>Sponsored</div><div style={{fontFamily:"Oswald,sans-serif",fontSize:15,color:form.textColor,marginBottom:4}}>{form.advertiser||"Your Brand"}</div><div style={{fontSize:11,color:form.textColor,opacity:.8}}>{form.tagline||"Your tagline"}</div></div>}
          {selectedSlot==="footer_strip"&&<div style={{background:form.bgColor,padding:"12px 24px",display:"flex",alignItems:"center",justifyContent:"center",gap:20,borderRadius:3}}><div style={{fontFamily:"Oswald,sans-serif",fontSize:15,color:form.textColor,letterSpacing:"1.5px"}}>{form.advertiser||"Your Brand"}</div><div style={{width:1,height:20,background:"rgba(255,255,255,.2)"}} /><div style={{fontSize:12,color:form.textColor}}>{form.tagline||"Tagline"}</div></div>}
          {selectedSlot==="modal_sponsor"&&<div style={{background:form.bgColor,padding:"12px 16px",borderRadius:3}}><div style={{fontSize:9,color:form.textColor,opacity:.5,letterSpacing:"2px",textTransform:"uppercase",marginBottom:4}}>Sponsored</div><div style={{display:"flex",alignItems:"center",gap:12}}><div style={{fontFamily:"Oswald,sans-serif",fontSize:14,color:form.textColor}}>{form.advertiser||"Your Brand"}</div><div style={{fontSize:11,color:form.textColor,opacity:.8}}>{form.tagline||"Tagline"}</div></div></div>}
        </div>

        {/* Campaign dates */}
        <div style={{fontSize:11,fontWeight:700,letterSpacing:"2px",textTransform:"uppercase",color:"var(--horizon)",marginBottom:12}}>Campaign Period</div>
        <div className="form-row">
          <div className="fg"><label>Start Date *</label><input type="date" min={today} value={form.startDate} onChange={e=>sf("startDate",e.target.value)} /></div>
          <div className="fg">
            <label>Duration</label>
            <select value={form.months} onChange={e=>sf("months",parseInt(e.target.value))}>
              {[1,2,3,6,12].map(m=><option key={m} value={m}>{m} month{m>1?"s":""} — N${((slot?.price||0)*m).toLocaleString()}</option>)}
            </select>
          </div>
        </div>

        {/* Cost summary */}
        <div style={{background:"rgba(232,146,12,.08)",border:"1px solid var(--dune)",borderRadius:3,padding:"14px 16px",marginBottom:20,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
          <div>
            <div style={{fontSize:11,color:"var(--sand)"}}>Campaign total · {form.months} month{form.months>1?"s":""} on {slot?.label}</div>
            {form.startDate && <div style={{fontSize:11,color:"var(--bark)",marginTop:2}}>{form.startDate} → {calcEnd()}</div>}
          </div>
          <div style={{fontFamily:"Oswald,sans-serif",fontSize:26,color:"var(--horizon)"}}>N$ {totalCost.toLocaleString()}</div>
        </div>

        <button className="btn-primary" style={{width:"100%",justifyContent:"center",padding:"15px",fontSize:14}} onClick={submitAd} disabled={submitting}>
          {submitting ? "⏳ Submitting..." : "📢 Submit Ad Request"}
        </button>
        <p style={{fontSize:11,color:"var(--bark)",marginTop:8,textAlign:"center"}}>Your ad will go live within 24 hours after BLC reviews and payment is confirmed.</p>
      </div>
    </div>
  );
}

// ── AD ADMIN PANEL ────────────────────────────────────────────────────────────
function AdminAdsPanel({ ads, setAds }) {
  const pendingCount = ads.filter(a => a.adStatus === "pending").length;
  const [adTab, setAdTab] = useState(pendingCount > 0 ? "pending" : "approved");
  const [showForm, setShowForm] = useState(false);
  const [editAd, setEditAd] = useState(null);
  const [rejectId, setRejectId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [form, setForm] = useState({ slot:"hero_banner", advertiser:"", tagline:"", link:"", bgColor:"#1a2a3a", textColor:"#ffffff", startDate:"", endDate:"", active:true, image:"" });
  const imgRef = useRef();
  const sf = (k,v) => setForm(f => ({...f, [k]:v}));

  const pendingAds   = ads.filter(a => a.adStatus === "pending");
  const approvedAds  = ads.filter(a => a.adStatus === "approved" || !a.adStatus); // backwards compat
  const rejectedAds  = ads.filter(a => a.adStatus === "rejected");
  const activeCount  = approvedAds.filter(a => a.active && new Date(a.endDate) >= new Date()).length;
  const monthRevenue = approvedAds.filter(a => a.active && new Date(a.endDate) >= new Date()).reduce((s,a) => s + (AD_SLOTS[a.slot]?.price||0), 0);
  const daysUntilExpiry = a => Math.ceil((new Date(a.endDate) - new Date()) / 86400000);
  const countPerSlot = (slot) => approvedAds.filter(a => a.slot===slot && a.active && new Date(a.endDate)>=new Date()).length;

  const approveAd = (id) => {
    const u = ads.map(a => a.id===id ? {...a, adStatus:"approved", active:true, approvedAt:Date.now()} : a);
    setAds(u); saveAds(u);
    const ad = u.find(a => a.id===id);
    if (ad?.phone) queueSms(ad.phone, SMS_TEMPLATES.ad_approved(ad), "ad_approved");
  };

  const rejectAd = (id) => {
    const u = ads.map(a => a.id===id ? {...a, adStatus:"rejected", active:false, rejectedAt:Date.now(), rejectionReason:rejectReason} : a);
    setAds(u); saveAds(u); setRejectId(null); setRejectReason("");
    const ad = u.find(a => a.id===id);
    if (ad?.phone) queueSms(ad.phone, SMS_TEMPLATES.ad_rejected(ad, rejectReason), "ad_rejected");
  };

  const toggleActive = (id) => { const u = ads.map(a => a.id===id?{...a,active:!a.active}:a); setAds(u); saveAds(u); };
  const deleteAd = (id) => { if (!window.confirm("Delete this ad?")) return; const u = ads.filter(a=>a.id!==id); setAds(u); saveAds(u); };

  const openNew = () => { setEditAd(null); setForm({ slot:"hero_banner", advertiser:"", tagline:"", link:"", bgColor:"#1a2a3a", textColor:"#ffffff", startDate:new Date().toISOString().split("T")[0], endDate:"", active:true, image:"", adStatus:"approved" }); setShowForm(true); };
  const openEdit = (ad) => { setEditAd(ad); setForm({...ad}); setShowForm(true); };

  const handleImg = (files) => {
    if (!files.length) return;
    const r = new FileReader(); r.onload = e => sf("image", e.target.result); r.readAsDataURL(files[0]);
  };

  const saveAd = () => {
    if (!form.advertiser || !form.endDate) { alert("Advertiser name and end date are required."); return; }
    let updated;
    if (editAd) { updated = ads.map(a => a.id===editAd.id ? {...form, id:editAd.id} : a); }
    else { updated = [...ads, { ...form, id:`ad_${Date.now()}`, adStatus:"approved" }]; }
    setAds(updated); saveAds(updated); setShowForm(false);
  };

  const fmtDate = ts => new Date(ts).toLocaleString("en-NA",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});

  const displayAds = adTab==="pending" ? pendingAds : adTab==="rejected" ? rejectedAds : approvedAds;

  return (
    <div>
      {/* Revenue summary */}
      <div className="revenue-summary">
        <div className="rev-item"><div className="rev-num green">N${monthRevenue.toLocaleString()}</div><div className="rev-label">Monthly Ad Revenue</div></div>
        <div className="rev-item"><div className="rev-num" style={{color:"#ef4444"}}>{pendingAds.length}</div><div className="rev-label">Pending Approval</div></div>
        <div className="rev-item"><div className="rev-num">{activeCount}</div><div className="rev-label">Active Ads</div></div>
        <div className="rev-item"><div className="rev-num" style={{color:"var(--teal-light)"}}>∞</div><div className="rev-label">Advertisers Per Slot</div></div>
        <div className="rev-item"><div className="rev-num">{Object.keys(AD_SLOTS).reduce((s,sl)=>s+ads.filter(a=>a.slot===sl&&a.active&&a.adStatus!=="rejected").length,0)>0?"🟢 ON":"⚫ OFF"}</div><div className="rev-label">Rotation Active</div></div>
      </div>

      {/* Slot status */}
      <div style={{marginBottom:24}}>
        <div style={{fontFamily:"Oswald,sans-serif",fontSize:16,letterSpacing:"1.5px",color:"var(--ivory)",marginBottom:12}}>AD SLOT STATUS</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10}}>
          {Object.values(AD_SLOTS).map(sl => {
            const sc = countPerSlot(sl.id);
            const rev = sc * sl.price;
            return (
              <div key={sl.id} style={{background:"var(--earth)",border:`1px solid ${sc>0?"var(--green-ok)":"var(--clay)"}`,borderRadius:4,padding:"12px 14px"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                  <div style={{fontWeight:700,fontSize:13,color:"var(--ivory)"}}>{SLOT_ICONS[sl.id]} {sl.label}</div>
                  <span style={{background:sc>0?"rgba(46,125,50,.2)":"rgba(100,100,100,.2)",color:sc>0?"#81c784":"var(--bark)",padding:"2px 8px",borderRadius:2,fontSize:9,fontWeight:700,letterSpacing:"1px",textTransform:"uppercase"}}>{sc>0?`${sc} active`:"Empty"}</span>
                </div>
                <div style={{fontFamily:"Oswald,sans-serif",fontSize:18,color:"var(--horizon)"}}>N${sl.price}<span style={{fontSize:11,color:"var(--sand)",fontFamily:"Lato"}}>/mo each</span></div>
                {sc>0&&<div style={{fontSize:11,color:sc>1?"var(--teal-light)":"var(--sand)",marginTop:2}}>{sc>1?`🔄 Rotating · N${rev}/mo`:`N$${rev}/mo`}</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Tabs + create button */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:12}}>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {[["pending","⏳ Pending",pendingAds],["approved","✅ Approved",approvedAds],["rejected","✕ Rejected",rejectedAds]].map(([t,l,arr])=>(
            <button key={t} className={`admin-tab${adTab===t?" active":""}`} onClick={()=>setAdTab(t)} style={t==="pending"&&pendingAds.length>0?{borderColor:"#ef4444"}:{}}>
              {l} <span className="bc" style={t==="pending"&&pendingAds.length>0?{background:"#ef4444",color:"#fff"}:{}}>{arr.length}</span>
            </button>
          ))}
        </div>
        <button className="btn-primary" onClick={openNew}>＋ Create Ad Directly</button>
      </div>

      {/* Reject reason modal */}
      {rejectId && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setRejectId(null)}>
          <div className="modal" style={{maxWidth:440}}>
            <div style={{fontFamily:"Oswald,sans-serif",fontSize:18,color:"var(--ivory)",marginBottom:14}}>Reject Ad — Add Reason</div>
            <div className="fg" style={{marginBottom:16}}>
              <label>Rejection Reason (sent to advertiser)</label>
              <textarea rows={3} placeholder="e.g. Ad content does not meet BLC standards. Please revise and resubmit." value={rejectReason} onChange={e=>setRejectReason(e.target.value)} />
            </div>
            <div style={{display:"flex",gap:10}}>
              <button className="btn-reject" style={{flex:1,justifyContent:"center",padding:"11px"}} onClick={()=>rejectAd(rejectId)}>✕ Confirm Rejection</button>
              <button className="btn-outline" onClick={()=>setRejectId(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit form */}
      {showForm && (
        <div className="ad-form">
          <div className="ad-form-title">{editAd ? "Edit Advertisement" : "Create New Advertisement"}</div>
          <div className="ad-slot-grid">
            {Object.values(AD_SLOTS).map(sl => (
              <div key={sl.id} className={`ad-slot-opt${form.slot===sl.id?" sel":""}`} onClick={() => sf("slot", sl.id)}>
                <div className="ad-slot-opt-name">{SLOT_ICONS[sl.id]} {sl.label}</div>
                <div className="ad-slot-opt-price">N${sl.price}/month</div>
                <div className="ad-slot-opt-desc">{sl.desc}</div>
              </div>
            ))}
          </div>
          <div className="form-row">
            <div className="fg"><label>Advertiser Name *</label><input placeholder="e.g. Puma Energy Namibia" value={form.advertiser} onChange={e=>sf("advertiser",e.target.value)} /></div>
            <div className="fg"><label>Website / Link</label><input placeholder="https://advertiser.com" value={form.link} onChange={e=>sf("link",e.target.value)} /></div>
          </div>
          <div className="fg" style={{marginBottom:14}}><label>Tagline *</label><input placeholder="Short advertising message" value={form.tagline} onChange={e=>sf("tagline",e.target.value)} /></div>
          <div className="form-row">
            <div className="fg"><label>Background Color</label><div style={{display:"flex",gap:8,alignItems:"center"}}><input type="color" value={form.bgColor} onChange={e=>sf("bgColor",e.target.value)} style={{width:44,height:36,padding:2,border:"1px solid var(--clay)",borderRadius:2,background:"none",cursor:"pointer"}} /><input value={form.bgColor} onChange={e=>sf("bgColor",e.target.value)} style={{flex:1}} /></div></div>
            <div className="fg"><label>Text Color</label><div style={{display:"flex",gap:8,alignItems:"center"}}><input type="color" value={form.textColor} onChange={e=>sf("textColor",e.target.value)} style={{width:44,height:36,padding:2,border:"1px solid var(--clay)",borderRadius:2,background:"none",cursor:"pointer"}} /><input value={form.textColor} onChange={e=>sf("textColor",e.target.value)} style={{flex:1}} /></div></div>
          </div>
          <div className="form-row">
            <div className="fg"><label>Start Date</label><input type="date" value={form.startDate} onChange={e=>sf("startDate",e.target.value)} /></div>
            <div className="fg"><label>End Date *</label><input type="date" value={form.endDate} onChange={e=>sf("endDate",e.target.value)} /></div>
          </div>
          <div className="fg" style={{marginBottom:14}}>
            <label>Ad Image (optional)</label>
            <div className="img-upload-zone" onClick={()=>imgRef.current.click()} style={{padding:"16px",minHeight:56}}>
              {form.image ? <img src={form.image} alt="" style={{maxHeight:70,objectFit:"contain",borderRadius:3}} /> : <><div className="up-icon" style={{fontSize:20,marginBottom:4}}>🖼</div><p>Click to upload image</p><small>JPG, PNG, WEBP</small></>}
              <input ref={imgRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleImg(e.target.files)} />
            </div>
            {form.image && <button className="btn-muted" style={{marginTop:6}} onClick={()=>sf("image","")}>✕ Remove</button>}
          </div>
          <div className="chk-row" style={{marginBottom:20}}>
            <input type="checkbox" id="ad-active" checked={form.active} onChange={e=>sf("active",e.target.checked)} />
            <label htmlFor="ad-active">Ad is active (visible to users immediately)</label>
          </div>
          <div style={{display:"flex",gap:12}}>
            <button className="btn-primary" onClick={saveAd} style={{flex:1,justifyContent:"center"}}>💾 {editAd?"Update Ad":"Create Ad"}</button>
            <button className="btn-outline" onClick={()=>setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Ad cards by tab */}
      {displayAds.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">📢</div>
          <h3>No {adTab} ads</h3>
          <p>{adTab==="pending" ? "When advertisers submit their ads, they'll appear here for your approval." : adTab==="rejected" ? "No rejected ads." : "Approve pending ads or create one directly above."}</p>
        </div>
      ) : (
        <div className="ad-admin-grid">
          {displayAds.map(ad => {
            const days = daysUntilExpiry(ad);
            const isExpired = days < 0;
            const isExpiring = !isExpired && days <= 7;
            return (
              <div key={ad.id} className={`ad-card${ad.adStatus==="pending"?" expiring":isExpired?" inactive-ad":ad.active?" active-ad":""}`}>
                {/* Preview */}
                <div className="ad-card-preview" style={{background:ad.bgColor||"#1a2a3a",minHeight:72}}>
                  {ad.image ? <img src={ad.image} alt="" style={{maxHeight:64,objectFit:"contain"}} />
                    : <><div style={{fontFamily:"Oswald,sans-serif",fontSize:14,color:ad.textColor||"#fff",fontWeight:700,textAlign:"center"}}>{ad.advertiser}</div>
                        <div style={{fontSize:11,color:ad.textColor||"#fff",opacity:.8,textAlign:"center"}}>{ad.tagline}</div></>}
                  {ad.adStatus==="pending" && <div style={{position:"absolute",top:6,right:6,background:"rgba(232,146,12,.9)",color:"#140d04",padding:"2px 8px",borderRadius:10,fontSize:9,fontWeight:700,letterSpacing:"1px"}}>PENDING</div>}
                </div>
                <div className="ad-card-body">
                  <div className="ad-card-name">{ad.advertiser}</div>
                  <div className={`ad-card-slot ${ad.slot}`}>{SLOT_ICONS[ad.slot]} {AD_SLOTS[ad.slot]?.label} — N${AD_SLOTS[ad.slot]?.price}/mo</div>
                  {ad.contactName && <div style={{fontSize:11,color:"var(--sand)",marginBottom:2}}>👤 {ad.contactName}{ad.phone?` · ${ad.phone}`:""}</div>}
                  {ad.email && <div style={{fontSize:11,color:"var(--teal-light)",marginBottom:4}}>✉ {ad.email}</div>}
                  <div className="ad-card-dates">📅 {ad.startDate} → {ad.endDate} {isExpiring&&<span style={{color:"#f59e0b",fontWeight:700}}>({days}d left)</span>}{isExpired&&<span style={{color:"#ef9a9a",fontWeight:700}}>(Expired)</span>}</div>
                  {ad.submittedAt && <div style={{fontSize:10,color:"var(--bark)",marginBottom:6}}>Submitted: {fmtDate(ad.submittedAt)}</div>}
                  {ad.adStatus==="rejected" && ad.rejectionReason && <div style={{fontSize:11,color:"#ef9a9a",background:"rgba(183,28,28,.1)",padding:"6px 8px",borderRadius:2,marginBottom:8}}>Reason: {ad.rejectionReason}</div>}
                  <div style={{marginBottom:8}}>
                    {ad.adStatus==="pending" && <span className="pill-pending-ad">⏳ Pending Review</span>}
                    {(ad.adStatus==="approved"||!ad.adStatus) && <span className={`ad-status ${isExpired?"exp":ad.active?"on":"off"}`}>{isExpired?"Expired":ad.active?"● Active":"○ Inactive"}</span>}
                    {ad.adStatus==="rejected" && <span className="pill-rejected-ad">✕ Rejected</span>}
                  </div>
                  <div className="action-btns">
                    {ad.adStatus==="pending" && <>
                      <button className="btn-approve" onClick={()=>approveAd(ad.id)}>✓ Approve</button>
                      <button className="btn-reject" onClick={()=>setRejectId(ad.id)}>✕ Reject</button>
                    </>}
                    {(ad.adStatus==="approved"||!ad.adStatus) && <button className="btn-approve" onClick={()=>toggleActive(ad.id)}>{ad.active?"Deactivate":"Activate"}</button>}
                    {ad.adStatus==="rejected" && <button className="btn-approve" onClick={()=>approveAd(ad.id)}>↩ Re-approve</button>}
                    <button className="btn-muted" onClick={()=>openEdit(ad)}>✏ Edit</button>
                    <button className="btn-muted" onClick={()=>deleteAd(ad.id)}>🗑</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// STAR RATING DISPLAY
// ─────────────────────────────────────────────────────────────────────────────
function StarDisplay({ rating, count }) {
  if (!rating) return <span style={{fontSize:11,color:"var(--bark)"}}>No ratings yet</span>;
  const full = Math.floor(rating);
  const half = rating - full >= 0.4;
  return (
    <span style={{display:"flex",alignItems:"center",gap:5}}>
      <span className="stars-display">
        {"★".repeat(full)}{half?"½":""}{"☆".repeat(5-full-(half?1:0))}
      </span>
      <span className="rating-num">{rating} ({count} review{count!==1?"s":""})</span>
    </span>
  );
}

function StarInput({ value, onChange }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="star-input">
      {[1,2,3,4,5].map(s => (
        <button key={s} className={`star-btn${(hover||value)>=s?" active":""}`}
          onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(0)}
          onClick={() => onChange(s)} type="button">★</button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// IMAGE UPLOAD
// ─────────────────────────────────────────────────────────────────────────────
function ImageUpload({ images, onChange, maxPhotos }) {
  const [drag, setDrag] = useState(false);
  const ref = useRef();
  const handle = useCallback((files) => {
    const rem = maxPhotos - images.length;
    if (rem <= 0) return;
    const readers = Array.from(files).slice(0, rem).map(f =>
      new Promise(res => { const r = new FileReader(); r.onload = e => res(e.target.result); r.readAsDataURL(f); })
    );
    Promise.all(readers).then(imgs => onChange([...images, ...imgs]));
  }, [images, onChange, maxPhotos]);
  return (
    <div>
      <div className="photo-limit-note">📷 {TIERS[maxPhotos===1?"free":maxPhotos===2?"featured":"premium"].label} tier: {images.length}/{maxPhotos} photos uploaded</div>
      {images.length < maxPhotos && (
        <div className={`img-upload-zone${drag?" drag":""}`}
          onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)}
          onDrop={e=>{e.preventDefault();setDrag(false);handle(e.dataTransfer.files);}}
          onClick={()=>ref.current.click()}>
          <div className="up-icon">📷</div>
          <p>Drag &amp; drop or <strong>click to browse</strong></p>
          <small>JPG, PNG, WEBP · {maxPhotos-images.length} slot{maxPhotos-images.length!==1?"s":""} remaining</small>
          <input ref={ref} type="file" accept="image/*" multiple style={{display:"none"}} onChange={e=>handle(e.target.files)} />
        </div>
      )}
      {images.length > 0 && (
        <div className="img-previews">
          {images.map((src,i) => (
            <div className="img-preview" key={i}>
              <img src={src} alt="" />
              <button className="img-del" onClick={()=>onChange(images.filter((_,j)=>j!==i))}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LISTING CARD
// ─────────────────────────────────────────────────────────────────────────────
function ListingCard({ listing, onClick, ratings, bids }) {
  const imgs = listing.images || [];
  const isSale = listing.listingType === "sale";
  const isSold = listing.sold === true;
  const tier = listing.tier || "free";
  const isPremium = tier === "premium";
  const isNew = Date.now() - listing.submittedAt < 86400000 * 2;
  const avg = avgRating(ratings, listing.id);
  const rCount = (ratings[listing.id] || []).length;
  const bidCount = isSale && bids ? bidCountForListing(bids, listing.id) : 0;
  const highBid = isSale && bids ? highestBidForListing(bids, listing.id) : null;
  return (
    <div className={`listing-card tier-${tier}${isSale?" sc":""}${isSold?" inactive-ad":""}`} onClick={() => onClick(listing)}>
      <div className="card-img">
        <div className={`type-rib ${isSale?"sale":"hire"}`}>
          <span>{isSale?"🏷 FOR SALE":"🔑 FOR HIRE"}</span>
          <div className="rib-right">
            {bidCount > 0 && !isSold && <span className="bid-badge">🔨 {bidCount} BID{bidCount!==1?"S":""}</span>}
            {tier !== "free" && !isSold && <span className={`rib-badge tier-badge-${tier}`}>{tier==="premium"?"⭐ PREMIUM":"★ FEATURED"}</span>}
            {tier === "free" && isNew && !isSold && <span className="rib-badge tier-badge-free">New</span>}
          </div>
        </div>
        {imgs.length > 0
          ? <img src={imgs[0]} alt={listing.name} />
          : <div className="card-ph"><span>{CAT_ICONS[listing.category]||"⚙️"}</span><p>No Photo</p></div>
        }
        {isSold && (
          <div className="sold-overlay">
            <div className="sold-stamp">SOLD</div>
          </div>
        )}
        {isPremium && !isSold && (
          <div style={{position:"absolute",bottom:8,right:8,zIndex:2}}>
            <div className="boost-badge" title="Traffic Booster active — click to share">🚀 BOOST</div>
          </div>
        )}
      </div>
      <div className="card-body">
        <div className={`card-cat${isSale?" sc":""}`}>{listing.category}</div>
        <div className="card-name">{listing.name}</div>
        <div className="card-meta">
          {listing.year && <span>📅 {listing.year}</span>}
          {listing.hours && <span>⏱ {parseInt(listing.hours).toLocaleString()}hrs</span>}
          {listing.condition && <span>🔎 {listing.condition}</span>}
        </div>
        <div className="card-rating">
          <StarDisplay rating={avg} count={rCount} />
        </div>
        <div className="card-loc">📍 {listing.location}, {listing.region}</div>
        <div className="card-desc">{listing.description}</div>
        <div className="card-foot">
          <div>
            <div className={`price-amt${isSale?" sc":""}`}>
              {isSold ? <span style={{color:"#ef4444"}}>SOLD</span> : `N$ ${parseInt(listing.price).toLocaleString()}`}
            </div>
            <div className="price-unit">
              {isSold ? "Transaction completed" : isSale?(listing.negotiable?"Neg. welcome":"Fixed price"):`per ${listing.unit}`}
            </div>
          </div>
          <button className={`btn-enq${isSale?" sc":""}${isSold?" ":" "}`}
            style={isSold?{borderColor:"#ef4444",color:"#ef4444",cursor:"default"}:{}}
            onClick={e=>{e.stopPropagation();onClick(listing);}}>
            {isSold?"Sold":"Enquire"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DETAIL MODAL — with interest form + rating
// ─────────────────────────────────────────────────────────────────────────────
function DetailModal({ listing, onClose, ratings, onRateSubmit, onInterestSubmit, ads, bookings, onBook, interests, bids, onBidPlaced }) {
  const [zoom, setZoom] = useState(null);
  const [showInterest, setShowInterest] = useState(false);
  const [ratingVal, setRatingVal] = useState(0);
  const [iForm, setIForm] = useState({ name:"", phone:"", email:"", company:"", message:"" });
  const [submitted, setSubmitted] = useState(false);

  if (!listing) return null;
  const isSale = listing.listingType === "sale";
  const isSold = listing.sold === true;
  const tier = listing.tier || "free";
  const isPremium = tier === "premium";
  const avg = avgRating(ratings, listing.id);
  const rCount = (ratings[listing.id] || []).length;
  const subj = encodeURIComponent((isSale?"Sale enquiry: ":"Hire enquiry: ") + listing.name);

  const handleInterest = () => {
    if (!iForm.name || !iForm.phone) { alert("Please enter your name and phone number."); return; }
    onInterestSubmit({ ...iForm, listingId: listing.id, listingName: listing.name, listingType: listing.listingType, rating: ratingVal, timestamp: Date.now(), read: false });
    if (ratingVal > 0) onRateSubmit(listing.id, ratingVal, iForm.name);
    setSubmitted(true);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <button className="modal-close" onClick={onClose}>✕</button>

        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
          <span className={`modal-type-tag ${isSale?"sale":"hire"}`}>{isSale?"🏷 For Sale":"🔑 For Hire"}</span>
          {tier !== "free" && <span className={`modal-tier-badge ${tier}`}>{tier==="premium"?"⭐ Premium":"★ Featured"}</span>}
          {isSold && <span className="sold-tag">🚫 SOLD</span>}
        </div>

        {(listing.images||[]).length > 0 && (
          <div className="modal-img-grid">
            {listing.images.map((src,i) => <img key={i} src={src} alt="" onClick={() => setZoom(src)} />)}
          </div>
        )}

        <div className={`modal-cat${isSale?" sc":""}`}>{listing.category} · {listing.region}</div>
        <h2>{listing.name}</h2>

        {/* Rating display */}
        <div className="modal-rating-row">
          <StarDisplay rating={avg} count={rCount} />
        </div>

        <p style={{fontSize:14,color:"var(--sand)",fontWeight:300,margin:"10px 0 13px",lineHeight:1.7}}>{listing.description}</p>

        <div className="modal-info-grid">
          <div className="ii"><label className={isSale?"sc":""}>Location</label><p>📍 {listing.location}, {listing.region}</p></div>
          <div className="ii"><label className={isSale?"sc":""}>Condition</label><p>{listing.condition||"—"}</p></div>
          {listing.year && <div className="ii"><label className={isSale?"sc":""}>Year</label><p>{listing.year}</p></div>}
          {listing.hours && <div className="ii"><label className={isSale?"sc":""}>Hours</label><p>{parseInt(listing.hours).toLocaleString()} hrs</p></div>}
          <div className="ii"><label className={isSale?"sc":""}>Category</label><p>{listing.category}</p></div>
          <div className="ii"><label className={isSale?"sc":""}>Listed By</label><p>🏢 BLC Verified</p></div>
        </div>

        <div className={`modal-price${isSale?" sc":""}`}>
          N$ {parseInt(listing.price).toLocaleString()}
          {isSale && listing.negotiable && <span className="nego-tag">Negotiable</span>}
        </div>
        <div className="modal-price-unit">{isSale?"Asking price":`per ${listing.unit}`}</div>

        {/* BLC Contact — only show if not sold */}
        {!isSold && (
          <div style={{background:"var(--soil)",border:`1px solid ${isPremium?"var(--teal-light)":"var(--clay)"}`,borderRadius:4,padding:"16px 18px",marginTop:16}}>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:"2px",textTransform:"uppercase",color:isPremium?"var(--teal-light)":"var(--horizon)",marginBottom:6}}>Enquire Through BLC Plant Hire</div>
            <p style={{fontSize:13,color:"var(--sand)",fontWeight:300,lineHeight:1.5,marginBottom:13}}>Contact BLC to get connected with the owner. Your details stay private.</p>
            <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
              <a href="tel:+264816034139" className={isSale?"btn-sale":"btn-primary"} style={{textDecoration:"none",display:"flex",alignItems:"center",gap:6,padding:"10px 18px",fontSize:12}}>📞 +264 81 603 4139</a>
              <a href={`mailto:blc.bertus@gmail.com?subject=${subj}`} className="btn-outline" style={{textDecoration:"none",display:"flex",alignItems:"center",gap:6,padding:"10px 18px",fontSize:12}}>✉ Email BLC</a>
              {isPremium && (
                <a href={`https://wa.me/264816034139?text=${encodeURIComponent("Hi BLC, interested in: "+listing.name)}`} target="_blank" rel="noreferrer"
                  style={{textDecoration:"none",display:"flex",alignItems:"center",gap:6,padding:"10px 18px",fontSize:12,background:"#25d366",color:"#fff",borderRadius:3,fontWeight:700,letterSpacing:"1px",textTransform:"uppercase"}}>
                  💬 WhatsApp
                </a>
              )}
            </div>
          </div>
        )}

        {/* SOLD notice */}
        {isSold && (
          <div style={{background:"rgba(239,68,68,.1)",border:"2px solid #ef4444",borderRadius:6,padding:"22px",textAlign:"center",marginTop:16}}>
            <div style={{fontSize:36,marginBottom:8}}>🚫</div>
            <div style={{fontFamily:"Oswald,sans-serif",fontSize:22,color:"#ef4444",letterSpacing:"2px",marginBottom:6}}>THIS ITEM HAS BEEN SOLD</div>
            <div style={{fontSize:13,color:"var(--sand)",lineHeight:1.6}}>This equipment has been sold. Contact BLC Plant Hire to find similar machines available for sale.</div>
            <div style={{display:"flex",gap:10,justifyContent:"center",marginTop:14,flexWrap:"wrap"}}>
              <a href="tel:+264816034139" className="btn-primary" style={{textDecoration:"none",display:"flex",alignItems:"center",gap:6,padding:"10px 18px",fontSize:12}}>📞 +264 81 603 4139</a>
              <a href="mailto:blc.bertus@gmail.com?subject=Looking for similar equipment" className="btn-outline" style={{textDecoration:"none",display:"flex",alignItems:"center",gap:6,padding:"10px 18px",fontSize:12}}>✉ Find Similar</a>
            </div>
          </div>
        )}

        {/* Modal sponsor ad */}
        {ads && <AdModalSponsor ads={ads} />}

        {/* PREMIUM: Traffic Booster */}
        {isPremium && !isSold && interests && bookings && (
          <TrafficBoosterPanel listing={listing} interests={interests} bookings={bookings} />
        )}

        {/* HIRE: Availability calendar & booking */}
        {!isSale && !isSold && bookings && (
          <BookingForm listing={listing} bookings={bookings} onBook={onBook} />
        )}

        {/* SALE: Bid form - buyers place bids */}
        {isSale && !isSold && bids && onBidPlaced && (
          <BidForm listing={listing} bids={bids} onBidPlaced={onBidPlaced} />
        )}

        {/* Interest / Rating form */}
        {!isSold && (
          <>
            <div className="modal-section-title">📋 Log Your Interest &amp; Rate This Equipment</div>
            {!submitted ? (
              <div className="interest-form">
                <div className="interest-form-title">Tell us about your interest — a BLC agent will follow up with you.</div>
                <div className="if-row">
                  <div className="fg"><label>Your Name *</label><input placeholder="Full name" value={iForm.name} onChange={e => setIForm(f=>({...f,name:e.target.value}))} /></div>
                  <div className="fg"><label>Phone Number *</label><input placeholder="+264 81 XXX XXXX" value={iForm.phone} onChange={e => setIForm(f=>({...f,phone:e.target.value}))} /></div>
                </div>
                <div className="if-row">
                  <div className="fg"><label>Email (optional)</label><input type="email" placeholder="your@email.com" value={iForm.email} onChange={e => setIForm(f=>({...f,email:e.target.value}))} /></div>
                  <div className="fg"><label>Company (optional)</label><input placeholder="Your company" value={iForm.company} onChange={e => setIForm(f=>({...f,company:e.target.value}))} /></div>
                </div>
                <div className="fg" style={{marginBottom:14}}>
                  <label>Message</label>
                  <textarea rows={2} placeholder="When do you need it? Any specific requirements?" value={iForm.message} onChange={e => setIForm(f=>({...f,message:e.target.value}))} />
                </div>
                <div className="fg" style={{marginBottom:16}}>
                  <label>Rate This Equipment (optional)</label>
                  <StarInput value={ratingVal} onChange={setRatingVal} />
                  {ratingVal > 0 && <span style={{fontSize:12,color:"var(--gold)",marginTop:4}}>{["","Poor","Fair","Good","Very Good","Excellent"][ratingVal]} — {ratingVal}/5</span>}
                </div>
                <button className={isSale?"btn-sale":"btn-primary"} style={{width:"100%",justifyContent:"center",padding:"13px"}} onClick={handleInterest}>
                  📩 Submit Interest
                </button>
              </div>
            ) : (
              <div style={{background:"rgba(46,125,50,.15)",border:"1px solid var(--green-ok)",borderRadius:4,padding:"18px 20px",textAlign:"center"}}>
                <div style={{fontSize:24,marginBottom:8}}>✅</div>
                <div style={{fontWeight:700,color:"#81c784",marginBottom:6}}>Interest logged successfully!</div>
                <div style={{fontSize:13,color:"var(--sand)"}}>A BLC agent will contact you at <strong>{iForm.phone}</strong> shortly.</div>
              </div>
            )}
          </>
        )}

        <div className="modal-actions"><button className="btn-outline" onClick={onClose}>Close</button></div>
      </div>
      {zoom && (
        <div onClick={()=>setZoom(null)} style={{position:"fixed",inset:0,zIndex:400,background:"rgba(0,0,0,.95)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"zoom-out"}}>
          <img src={zoom} alt="" style={{maxWidth:"92vw",maxHeight:"88vh",objectFit:"contain",borderRadius:4}} />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CHAT WIDGET (Public side)
// ─────────────────────────────────────────────────────────────────────────────
function ChatWidget({ chats, onSend, sessionId }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [userName, setUserName] = useState("");
  const [nameSet, setNameSet] = useState(false);
  const [tempName, setTempName] = useState("");
  const msgEndRef = useRef();

  const myMsgs = chats[sessionId] || [];
  const unread = myMsgs.filter(m => m.from === "admin" && !m.readByUser).length;

  useEffect(() => {
    if (open && msgEndRef.current) msgEndRef.current.scrollIntoView({ behavior:"smooth" });
    if (open && myMsgs.length) {
      const updated = { ...chats };
      updated[sessionId] = myMsgs.map(m => m.from === "admin" ? {...m, readByUser:true} : m);
      saveChats(updated);
    }
  }, [open, myMsgs.length]);

  const send = () => {
    if (!msg.trim()) return;
    onSend(sessionId, { from:"user", name:userName, text:msg.trim(), ts:Date.now(), readByAdmin:false, readByUser:true });
    setMsg("");
  };

  const fmt = ts => new Date(ts).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});

  return (
    <div className="chat-widget">
      {open && (
        <div className="chat-panel">
          <div className="chat-header">
            <div className="chat-header-title">
              <div className="chat-online" />
              💬 Chat with BLC
            </div>
            <button className="chat-close" onClick={() => setOpen(false)}>✕</button>
          </div>
          <div className="chat-messages">
            {myMsgs.length === 0 && (
              <div style={{fontSize:12,color:"var(--bark)",textAlign:"center",marginTop:20}}>
                👋 Hi! Chat with a BLC agent about any listing.
              </div>
            )}
            {myMsgs.map((m, i) => (
              <div key={i} className={`chat-msg ${m.from === "user" ? "me" : "admin"}`}>
                <div className="chat-msg-meta">{m.from === "admin" ? "BLC Agent" : m.name} · {fmt(m.ts)}</div>
                {m.text}
              </div>
            ))}
            <div ref={msgEndRef} />
          </div>
          {!nameSet ? (
            <div className="chat-name-form">
              <p>Enter your name to start chatting:</p>
              <div style={{display:"flex",gap:8}}>
                <input className="chat-input" style={{borderRadius:3}} placeholder="Your name..." value={tempName} onChange={e=>setTempName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&tempName.trim()&&(setUserName(tempName.trim()),setNameSet(true))} />
                <button className="chat-send" onClick={()=>{if(tempName.trim()){setUserName(tempName.trim());setNameSet(true);}}}>→</button>
              </div>
            </div>
          ) : (
            <div className="chat-input-row">
              <input className="chat-input" placeholder="Type a message..." value={msg} onChange={e=>setMsg(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} />
              <button className="chat-send" onClick={send}>➤</button>
            </div>
          )}
        </div>
      )}
      <button className="chat-bubble-btn" onClick={() => setOpen(o => !o)}>
        💬
        {unread > 0 && <span className="chat-unread">{unread}</span>}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN CHAT PANEL (inside admin page)
// ─────────────────────────────────────────────────────────────────────────────
function AdminChatPanel({ chats, onReply }) {
  const [activeSession, setActiveSession] = useState(null);
  const [replyText, setReplyText] = useState("");
  const msgEndRef = useRef();

  const sessions = Object.entries(chats).filter(([, msgs]) => msgs.length > 0);
  const unreadCount = s => (chats[s] || []).filter(m => m.from === "user" && !m.readByAdmin).length;
  const totalUnread = sessions.reduce((sum, [s]) => sum + unreadCount(s), 0);

  const activeMsgs = activeSession ? (chats[activeSession] || []) : [];
  useEffect(() => { if (msgEndRef.current) msgEndRef.current.scrollIntoView({behavior:"smooth"}); }, [activeMsgs.length, activeSession]);

  const sendReply = () => {
    if (!replyText.trim() || !activeSession) return;
    onReply(activeSession, { from:"admin", name:"BLC Admin", text:replyText.trim(), ts:Date.now(), readByAdmin:true, readByUser:false });
    setReplyText("");
  };

  const fmt = ts => new Date(ts).toLocaleString([], {month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});
  const getUser = s => { const msgs = chats[s]||[]; const u = msgs.find(m=>m.from==="user"); return u?.name || s.slice(-8); };

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
        <div style={{fontFamily:"Oswald,sans-serif",fontSize:22,letterSpacing:"1.5px",color:"var(--ivory)"}}>LIVE CHAT</div>
        {totalUnread > 0 && <span style={{background:"#ef4444",color:"#fff",padding:"2px 10px",borderRadius:10,fontSize:11,fontWeight:700}}>{totalUnread} unread</span>}
      </div>
      {sessions.length === 0 ? (
        <div className="empty"><div className="empty-icon">💬</div><h3>No chats yet</h3><p>When visitors start chatting, they'll appear here.</p></div>
      ) : (
        <div style={{display:"grid",gridTemplateColumns:"220px 1fr",gap:16,minHeight:400}}>
          {/* Session list */}
          <div style={{borderRight:"1px solid var(--clay)",paddingRight:16}}>
            {sessions.map(([sessionId]) => {
              const uc = unreadCount(sessionId);
              const lastMsg = (chats[sessionId]||[]).slice(-1)[0];
              return (
                <div key={sessionId}
                  onClick={() => { setActiveSession(sessionId); const updated={...chats}; updated[sessionId]=(updated[sessionId]||[]).map(m=>m.from==="user"?{...m,readByAdmin:true}:m); onReply(null,null,updated); }}
                  style={{padding:"10px 12px",borderRadius:4,cursor:"pointer",marginBottom:8,background:activeSession===sessionId?"var(--smoke)":"transparent",border:"1px solid",borderColor:uc>0?"var(--savanna)":"var(--clay)"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{fontWeight:700,fontSize:13,color:"var(--ivory)"}}>{getUser(sessionId)}</div>
                    {uc > 0 && <span style={{background:uc>0?"#ef4444":"var(--clay)",color:"#fff",padding:"1px 7px",borderRadius:10,fontSize:10,fontWeight:700}}>{uc}</span>}
                  </div>
                  {lastMsg && <div style={{fontSize:11,color:"var(--sand)",marginTop:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{lastMsg.text}</div>}
                </div>
              );
            })}
          </div>
          {/* Chat window */}
          {activeSession ? (
            <div className="admin-chat-panel">
              <div style={{padding:"12px 16px",borderBottom:"1px solid var(--clay)",fontWeight:700,fontSize:13,color:"var(--ivory)"}}>
                Chatting with: {getUser(activeSession)}
              </div>
              <div className="admin-chat-list">
                {activeMsgs.map((m,i) => (
                  <div key={i} className={`admin-chat-msg ${m.from==="admin"?"from-admin":"from-user"}`}>
                    <div className={`acm-meta${m.from==="admin"?" admin":""}`}>{m.from==="admin"?"BLC Admin":m.name} · {fmt(m.ts)}</div>
                    {m.text}
                  </div>
                ))}
                <div ref={msgEndRef} />
              </div>
              <div className="admin-chat-input-row">
                <input className="admin-chat-input" placeholder="Type reply..." value={replyText} onChange={e=>setReplyText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendReply()} />
                <button className="btn-primary" style={{padding:"8px 16px",fontSize:12}} onClick={sendReply}>Send</button>
              </div>
            </div>
          ) : (
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",color:"var(--bark)",fontSize:14}}>← Select a conversation</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN LEADS PANEL
// ─────────────────────────────────────────────────────────────────────────────
function AdminLeadsPanel({ interests, onMarkRead }) {
  const [filter, setFilter] = useState("all");
  const unread = interests.filter(i => !i.read);
  const display = filter === "unread" ? unread : interests;
  const fmt = ts => new Date(ts).toLocaleString([], {day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
  const stars = n => "★".repeat(n) + "☆".repeat(5-n);

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:20,flexWrap:"wrap"}}>
        <div style={{fontFamily:"Oswald,sans-serif",fontSize:22,letterSpacing:"1.5px",color:"var(--ivory)"}}>LEADS &amp; INTERESTS</div>
        {unread.length > 0 && <span style={{background:"#ef4444",color:"#fff",padding:"2px 10px",borderRadius:10,fontSize:11,fontWeight:700}}>{unread.length} new</span>}
        <div style={{display:"flex",gap:8,marginLeft:"auto"}}>
          <button className={`admin-tab${filter==="all"?" active":""}`} onClick={()=>setFilter("all")}>All ({interests.length})</button>
          <button className={`admin-tab${filter==="unread"?" active":""}`} onClick={()=>setFilter("unread")}>Unread ({unread.length})</button>
        </div>
      </div>
      {display.length === 0 ? (
        <div className="empty"><div className="empty-icon">📭</div><h3>No leads yet</h3><p>When visitors log interest in listings, they'll appear here with their full contact details.</p></div>
      ) : (
        display.slice().reverse().map((lead, i) => (
          <div key={i} className={`lead-card${!lead.read?" unread":""}`}>
            <div className="lead-header">
              <div>
                <div className="lead-name">👤 {lead.name}{lead.company ? ` — ${lead.company}` : ""}</div>
                <div className="lead-time">⏰ {fmt(lead.timestamp)}</div>
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                {lead.rating > 0 && <span className="lead-rating">{stars(lead.rating)} ({lead.rating}/5)</span>}
                {!lead.read && <button className="btn-muted" style={{fontSize:10}} onClick={() => onMarkRead(lead.timestamp)}>Mark Read</button>}
              </div>
            </div>

            {/* FULL CONTACT — admin only */}
            <div className="lead-contact">
              <p>📞 <strong>Phone:</strong> <a href={`tel:${lead.phone}`}>{lead.phone}</a></p>
              {lead.email && <p>✉ <strong>Email:</strong> <a href={`mailto:${lead.email}`} style={{color:"var(--teal-light)"}}>{lead.email}</a></p>}
            </div>

            <div className="lead-listing">
              🏗 Interested in: <strong style={{color:"var(--ivory)"}}>{lead.listingName}</strong> ({lead.listingType === "hire" ? "🔑 Hire" : "🏷 Sale"})
            </div>

            {lead.message && <div className="lead-msg">"{lead.message}"</div>}

            <div className="lead-actions">
              <a href={`tel:${lead.phone}`} className="btn-primary" style={{textDecoration:"none",display:"inline-flex",alignItems:"center",gap:6,padding:"7px 14px",fontSize:11}}>📞 Call</a>
              {lead.email && <a href={`mailto:${lead.email}?subject=Re: ${encodeURIComponent(lead.listingName)}`} className="btn-outline" style={{textDecoration:"none",display:"inline-flex",alignItems:"center",gap:6,padding:"7px 14px",fontSize:11}}>✉ Email</a>}
              <a href={`https://wa.me/${lead.phone.replace(/\D/g,"")}`} target="_blank" rel="noreferrer" style={{textDecoration:"none",display:"inline-flex",alignItems:"center",gap:6,padding:"7px 14px",fontSize:11,background:"#25d366",color:"#fff",borderRadius:3,fontWeight:700,fontSize:11}}>💬 WhatsApp</a>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PRICING PAGE
// ─────────────────────────────────────────────────────────────────────────────
function PricingPage({ onSelect }) {
  const [selected, setSelected] = useState(null);
  const pick = key => { setSelected(key); if (key === "free") setTimeout(() => onSelect(key), 300); };
  return (
    <div className="pricing-page">
      <div className="pricing-title">CHOOSE YOUR <span>LISTING TIER</span></div>
      <p className="pricing-sub">Select a plan. Free listings go live after BLC review. Featured & Premium require payment first.</p>
      <div className="pricing-grid">
        {Object.values(TIERS).map(tier => (
          <div key={tier.key} className={`tier-card ${tier.key}${selected===tier.key?" selected":""}`} onClick={() => pick(tier.key)}>
            {tier.key === "premium" && <div className="tier-popular">⭐ Most Visibility</div>}
            <div className="tier-name">{tier.label}</div>
            <div className="tier-price">{tier.price === 0 ? "FREE" : `N$${tier.price}`}</div>
            <div className="tier-period">{tier.price === 0 ? "Always free" : "per month"}</div>
            <ul className="tier-perks">{tier.perks.map((p,i)=><li key={i}>{p}</li>)}</ul>
            <button className="tier-select-btn" onClick={e=>{e.stopPropagation();pick(tier.key);}}>
              {tier.key==="free"?"List for Free":tier.key==="featured"?"Get Featured":"Go Premium"}
            </button>
          </div>
        ))}
      </div>
      {selected && selected !== "free" && (
        <div className="pay-box">
          <div className="pay-box-title">💳 Payment — <span>{TIERS[selected].label} ({TIERS[selected].priceLabel})</span></div>
          <div className="pay-box-sub">Make an EFT to BLC Suppliers and Trading. Your listing activates after payment confirmation.</div>
          <div className="bank-details">
            {[["Account Name",BLC_BANK.name],["Bank",BLC_BANK.bank],["Account Number",BLC_BANK.account,true],["Branch Code",BLC_BANK.branch],["Branch",BLC_BANK.branchName],["Amount",`N$ ${TIERS[selected].price}.00`,true],["Reference","PLANTHIRE-[YOUR NAME]"]].map(([l,v,a])=>(
              <div className="bank-row" key={l}><span className="bank-label">{l}</span><span className={`bank-value${a?" accent":""}`}>{v}</span></div>
            ))}
          </div>
          <div className="pay-note"><strong>After paying:</strong> Submit your listing and mention your payment reference in the description, or contact BLC at <strong>+264 81 603 4139</strong> / <strong>blc.bertus@gmail.com</strong> with proof of payment.</div>
          <div style={{marginTop:20,display:"flex",gap:12,flexWrap:"wrap"}}>
            <button className={selected==="premium"?"btn-sale":"btn-primary"} style={{flex:1,justifyContent:"center"}} onClick={() => onSelect(selected)}>✓ I've Paid — Continue to Form</button>
            <button className="btn-outline" onClick={() => setSelected(null)}>← Change Tier</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBMIT PAGE
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// OWNER — EQUIPMENT LISTING FOR HIRE AGREEMENT
// ─────────────────────────────────────────────────────────────────────────────
function OwnerHireAgreement({ form, tier, onAccept, onBack }) {
  const [ag1,setAg1]=useState(false);
  const [ag2,setAg2]=useState(false);
  const [ag3,setAg3]=useState(false);
  const [ag4,setAg4]=useState(false);
  const [ag5,setAg5]=useState(false);
  const [ag6,setAg6]=useState(false);
  const [sig,setSig]=useState("");
  const today = new Date().toLocaleDateString("en-NA",{day:"numeric",month:"long",year:"numeric"});
  const canSign = ag1&&ag2&&ag3&&ag4&&ag5&&ag6&&sig.trim().length>1;

  return (
    <div>
      <div style={{background:"rgba(212,118,10,.08)",border:"1px solid var(--dune)",borderRadius:3,padding:"10px 14px",marginBottom:14,fontSize:12,color:"var(--sand)",lineHeight:1.6}}>
        📄 Please read and accept the <strong style={{color:"var(--horizon)"}}>Equipment Owner Listing Agreement</strong> before your listing goes live on BLC.
      </div>
      <div className="owner-ag-wrap">
        <div className="owner-ag-header hire-ag">
          <h3>EQUIPMENT OWNER LISTING AGREEMENT — FOR HIRE</h3>
          <p>BLC SUPPLIERS AND TRADING · CC/2017/00361 · NAMIBIA</p>
        </div>
        <div className="owner-ag-body">
          <div style={{textAlign:"center",padding:"14px 0 8px",borderBottom:"1px solid var(--clay)",marginBottom:4}}>
            <div style={{fontFamily:"Oswald,sans-serif",fontSize:14,color:"var(--ivory)",letterSpacing:"1px"}}>PLANT &amp; EQUIPMENT HIRE LISTING AGREEMENT</div>
            <div style={{fontSize:11,color:"var(--sand)",marginTop:4}}>Entered into on <strong style={{color:"var(--dust)"}}>{today}</strong></div>
          </div>

          <div className="ag-parties">
            <div>
              <div className="ag-party-label">Platform Operator</div>
              <div className="ag-party-value">BLC Suppliers and Trading</div>
              <div className="ag-party-sub">CC/2017/00361 · Rosh Pinah, Namibia</div>
              <div className="ag-party-sub">Tel: +264 81 603 4139</div>
              <div className="ag-party-sub">blc.bertus@gmail.com</div>
            </div>
            <div>
              <div className="ag-party-label">Equipment Owner</div>
              <div className="ag-party-value">{form.name || "—"}</div>
              <div className="ag-party-sub">Tel: {form.contact}</div>
              {form.email && <div className="ag-party-sub">{form.email}</div>}
            </div>
          </div>

          <div className="ag-section">
            <h4>1. Equipment Being Listed</h4>
            <ul>
              <li><strong>Equipment:</strong> {form.name}</li>
              <li><strong>Category:</strong> {form.category}</li>
              <li><strong>Condition:</strong> {form.condition}</li>
              {form.year && <li><strong>Year:</strong> {form.year}</li>}
              {form.hours && <li><strong>Hours:</strong> {parseInt(form.hours).toLocaleString()} hrs</li>}
              <li><strong>Hire Rate:</strong> N$ {parseInt(form.price||0).toLocaleString()} per {form.unit}</li>
              <li><strong>Location:</strong> {form.location}, {form.region}</li>
              <li><strong>Listing Tier:</strong> {TIERS[tier]?.label} (N${TIERS[tier]?.price}/month)</li>
            </ul>
          </div>

          <div className="ag-section">
            <h4>2. Owner's Warranties &amp; Representations</h4>
            <ul>
              <li>The Owner warrants that they are the <strong>lawful owner</strong> of the equipment and have full legal authority to list it for hire.</li>
              <li>The Owner confirms the equipment is <strong>free of any encumbrances, liens, or financing agreements</strong> that would prevent or restrict its hire, unless disclosed in writing to BLC.</li>
              <li>The Owner warrants that all information provided in the listing is <strong>accurate, complete, and not misleading</strong>.</li>
              <li>The Owner confirms the equipment is in the <strong>condition stated</strong> in the listing and fit for its intended purpose.</li>
              <li>The Owner confirms the equipment meets all applicable <strong>Namibian safety and roadworthiness standards</strong> and holds all required certifications.</li>
              <li>The Owner must notify BLC immediately of any change in the equipment's condition, availability, or ownership status.</li>
            </ul>
          </div>

          <div className="ag-section">
            <h4>3. BLC's Role as Intermediary</h4>
            <ul>
              <li>BLC acts solely as a <strong>platform and intermediary</strong> connecting equipment owners with hirers. BLC is not a party to the hire transaction between the Owner and the Hirer.</li>
              <li>BLC reserves the right to <strong>review, approve, reject, or remove</strong> any listing at its sole discretion, without liability to the Owner.</li>
              <li>BLC may edit listing descriptions for clarity, grammar, or compliance with platform standards, but will not materially alter technical specifications without Owner consent.</li>
              <li>BLC does not guarantee a minimum number of bookings or enquiries for any listing.</li>
              <li>BLC will collect booking requests and forward them to the Owner for fulfilment. Final hire terms are between the Owner and Hirer.</li>
            </ul>
          </div>

          <div className="ag-section">
            <h4>4. Listing Fees &amp; Platform Charges</h4>
            <ul>
              <li>The Owner agrees to pay BLC the <strong>listing fee of N$ {TIERS[tier]?.price}/month</strong> for the selected tier ({TIERS[tier]?.label}).</li>
              <li>Listing fees are payable in advance to Bank Windhoek, Account 8052167764, Branch 486-372, reference PLANTHIRE-[Owner Name].</li>
              <li>BLC reserves the right to suspend or remove listings where fees are outstanding.</li>
              <li>No commission or transaction fee is charged by BLC on hire revenue unless separately agreed in writing.</li>
              <li>Listing fees are <strong>non-refundable</strong> once the listing has been published and made live on the platform.</li>
            </ul>
          </div>

          <div className="ag-section">
            <h4>5. Maintenance, Safety &amp; Legal Compliance</h4>
            <ul>
              <li>The Owner is solely responsible for ensuring the equipment is <strong>properly maintained, serviced, and safe</strong> for use at all times during any hire period.</li>
              <li>The Owner must ensure the equipment complies with all applicable Namibian laws including the <strong>Labour Act, Mines Works and Minerals Act, Road Transportation Act, and Environmental Management Act</strong>.</li>
              <li>The Owner must carry <strong>adequate insurance</strong> on the equipment covering at minimum: damage, third-party liability, and theft. Proof of insurance may be required by BLC.</li>
              <li>The Owner indemnifies BLC against any claims, fines, penalties, or losses arising from the Owner's failure to maintain equipment properly or comply with applicable laws.</li>
              <li>Any accident, injury, or damage involving the listed equipment must be reported to BLC within 24 hours.</li>
            </ul>
          </div>

          <div className="ag-section">
            <h4>6. Availability &amp; Fulfilment Obligations</h4>
            <ul>
              <li>The Owner must keep the listing's availability <strong>accurate and up to date</strong> at all times. Availability indicated on the platform is treated as binding.</li>
              <li>Once a booking is <strong>confirmed by BLC</strong>, the Owner is obligated to deliver the equipment to the agreed site on the confirmed start date.</li>
              <li>The Owner must give BLC at least <strong>48 hours' notice</strong> of any unavailability arising after a booking is confirmed.</li>
              <li>Failure to fulfil a confirmed booking without adequate notice may result in <strong>suspension or permanent removal</strong> of the Owner's listings from the platform.</li>
              <li>The Owner agrees to honour the <strong>hire rate as listed</strong> for any confirmed booking and may not unilaterally increase the rate after booking confirmation.</li>
            </ul>
          </div>

          <div className="ag-section">
            <h4>7. Owner's Liability to Hirers</h4>
            <ul>
              <li>The Owner is solely responsible for the equipment's performance, fitness for purpose, and any losses suffered by the Hirer arising from equipment failure or defects.</li>
              <li>The Owner must resolve all disputes with Hirers directly. BLC may assist in mediation but is not liable for the outcome of disputes between Owners and Hirers.</li>
              <li>The Owner is liable for any damage to the Hirer's property or injury to the Hirer's employees caused by a defect in the equipment that existed at the time of delivery.</li>
            </ul>
          </div>

          <div className="ag-section">
            <h4>8. Intellectual Property &amp; Listing Content</h4>
            <ul>
              <li>The Owner grants BLC a <strong>non-exclusive, royalty-free licence</strong> to use the listing content (description, photos, specifications) for the purpose of displaying and promoting the listing on the platform and in marketing materials.</li>
              <li>The Owner warrants that all photos and content submitted are their own and do not infringe any third-party intellectual property rights.</li>
              <li>This licence terminates automatically upon the removal of the listing from the platform.</li>
            </ul>
          </div>

          <div className="ag-section">
            <h4>9. Prohibited Conduct</h4>
            <ul>
              <li>The Owner must not list equipment that is <strong>stolen, subject to an attachment order, or encumbered</strong> without disclosure.</li>
              <li>The Owner must not provide false, misleading, or fraudulent information in their listing.</li>
              <li>The Owner must not attempt to circumvent BLC's platform by directing Hirers to contact them outside the platform to avoid listing fees.</li>
              <li>Any breach of this clause will result in immediate removal of all listings and possible legal action by BLC.</li>
            </ul>
          </div>

          <div className="ag-section">
            <h4>10. Termination &amp; Removal</h4>
            <ul>
              <li>The Owner may remove their listing at any time. Listing fees paid for the current period are non-refundable.</li>
              <li>BLC may terminate this agreement and remove the Owner's listings immediately for breach of any material term, fraudulent conduct, or reputational harm to BLC.</li>
              <li>On termination, both parties are released from future obligations but remain liable for obligations accrued before termination.</li>
            </ul>
          </div>

          <div className="ag-section">
            <h4>11. Dispute Resolution &amp; Governing Law</h4>
            <ul>
              <li>Disputes shall first be referred to mediation. If unresolved within 21 days, disputes shall be settled by arbitration under the <strong>Arbitration Act of Namibia</strong>.</li>
              <li>This agreement is governed by the <strong>laws of the Republic of Namibia</strong>.</li>
              <li>Both parties consent to the jurisdiction of the <strong>High Court of Namibia, Main Division</strong>.</li>
            </ul>
          </div>

          <div className="ag-section">
            <h4>12. General</h4>
            <ul>
              <li>This agreement supersedes all prior representations and constitutes the entire agreement between the Owner and BLC regarding the listing of equipment for hire.</li>
              <li>No variation is valid unless in writing and signed by both parties.</li>
              <li>Electronic acceptance constitutes a valid and binding signature under Namibian law.</li>
              <li>If any clause is found unenforceable, remaining clauses continue in full force.</li>
            </ul>
          </div>

          <div style={{marginTop:16,padding:"12px 16px",background:"rgba(212,118,10,.08)",border:"1px solid var(--dune)",borderRadius:3,fontSize:11,color:"var(--sand)",lineHeight:1.7}}>
            <strong style={{color:"var(--horizon)"}}>IMPORTANT:</strong> By accepting electronically, the Owner confirms all warranties, accepts all obligations, and authorises BLC to publish this listing on the platform.
          </div>
        </div>

        {/* Footer + signatures */}
        <div className="agreement-footer">
          <div style={{fontFamily:"Oswald,sans-serif",fontSize:14,color:"var(--ivory)",letterSpacing:"1px",marginBottom:14}}>OWNER ACCEPTANCE</div>
          {[
            [ag1,setAg1,"ag_h1","I confirm I am the lawful owner of this equipment and have full authority to list it for hire on BLC's platform."],
            [ag2,setAg2,"ag_h2","I warrant that all information in this listing is accurate, complete, and not misleading, and the equipment is in the stated condition."],
            [ag3,setAg3,"ag_h3","I confirm adequate insurance is in place and the equipment complies with all applicable Namibian safety and legal requirements."],
            [ag4,setAg4,"ag_h4","I agree to fulfil all confirmed bookings and keep availability accurate. I accept that failure to fulfil a confirmed booking may result in suspension."],
            [ag5,setAg5,"ag_h5","I accept BLC's role as intermediary and agree to the listing fee structure. I acknowledge listing fees are non-refundable once published."],
            [ag6,setAg6,"ag_h6","I grant BLC a non-exclusive licence to use my listing content and photos for the purpose of promoting my listing on the platform."],
          ].map(([val,setter,id,text])=>(
            <div className="agree-checkbox-row" key={id}>
              <input type="checkbox" id={id} checked={val} onChange={e=>setter(e.target.checked)} />
              <label htmlFor={id}>{text}</label>
            </div>
          ))}
          <div className="sig-row" style={{marginTop:16}}>
            <div className="sig-box">
              <div className="sig-label">Owner Electronic Signature</div>
              <input className="sig-input" placeholder="Type your full name to sign..." value={sig} onChange={e=>setSig(e.target.value)} />
              <div style={{fontSize:10,color:"var(--bark)",marginTop:6}}>{today}</div>
            </div>
            <div className="sig-box">
              <div className="sig-label">For BLC Suppliers &amp; Trading</div>
              <div style={{fontFamily:"Lato,sans-serif",fontSize:14,fontStyle:"italic",color:"var(--ivory)",borderBottom:"1px solid var(--clay)",paddingBottom:4,marginBottom:4}}>Bertus Christiaan</div>
              <div style={{fontSize:10,color:"var(--bark)"}}>Managing Director · CC/2017/00361</div>
            </div>
          </div>
          <button className="btn-primary" style={{width:"100%",justifyContent:"center",padding:"14px",marginTop:4,opacity:canSign?1:.45}}
            onClick={() => { if(!canSign){alert("Please tick all boxes and type your full name.");return;} onAccept(sig); }}>
            ✅ Accept Agreement & Submit Hire Listing
          </button>
          {!canSign && <p style={{fontSize:11,color:"var(--bark)",marginTop:8,textAlign:"center"}}>Tick all checkboxes and type your full name to enable submission.</p>}
          <button className="btn-outline" style={{width:"100%",justifyContent:"center",padding:"10px",marginTop:8}} onClick={onBack}>← Back to Form</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OWNER — EQUIPMENT LISTING FOR SALE AGREEMENT
// ─────────────────────────────────────────────────────────────────────────────
function OwnerSaleAgreement({ form, tier, onAccept, onBack }) {
  const [ag1,setAg1]=useState(false);
  const [ag2,setAg2]=useState(false);
  const [ag3,setAg3]=useState(false);
  const [ag4,setAg4]=useState(false);
  const [ag5,setAg5]=useState(false);
  const [ag6,setAg6]=useState(false);
  const [ag7,setAg7]=useState(false);
  const [sig,setSig]=useState("");
  const today = new Date().toLocaleDateString("en-NA",{day:"numeric",month:"long",year:"numeric"});
  const canSign = ag1&&ag2&&ag3&&ag4&&ag5&&ag6&&ag7&&sig.trim().length>1;

  return (
    <div>
      <div style={{background:"rgba(34,160,144,.08)",border:"1px solid var(--teal-light)",borderRadius:3,padding:"10px 14px",marginBottom:14,fontSize:12,color:"var(--sand)",lineHeight:1.6}}>
        📄 Please read and accept the <strong style={{color:"var(--teal-light)"}}>Equipment Sale Listing Agreement</strong> before your listing goes live on BLC.
      </div>
      <div className="owner-ag-wrap sale-ag">
        <div className="owner-ag-header sale-ag-h">
          <h3>EQUIPMENT OWNER LISTING AGREEMENT — FOR SALE</h3>
          <p>BLC SUPPLIERS AND TRADING · CC/2017/00361 · NAMIBIA</p>
        </div>
        <div className="owner-ag-body">
          <div style={{textAlign:"center",padding:"14px 0 8px",borderBottom:"1px solid var(--clay)",marginBottom:4}}>
            <div style={{fontFamily:"Oswald,sans-serif",fontSize:14,color:"var(--ivory)",letterSpacing:"1px"}}>PLANT &amp; EQUIPMENT SALE LISTING AGREEMENT</div>
            <div style={{fontSize:11,color:"var(--sand)",marginTop:4}}>Entered into on <strong style={{color:"var(--dust)"}}>{today}</strong></div>
          </div>

          <div className="ag-parties">
            <div>
              <div className="ag-party-label">Platform Operator</div>
              <div className="ag-party-value">BLC Suppliers and Trading</div>
              <div className="ag-party-sub">CC/2017/00361 · Rosh Pinah, Namibia</div>
              <div className="ag-party-sub">Tel: +264 81 603 4139</div>
            </div>
            <div>
              <div className="ag-party-label">Seller / Equipment Owner</div>
              <div className="ag-party-value">{form.name || "—"}</div>
              <div className="ag-party-sub">Tel: {form.contact}</div>
              {form.email && <div className="ag-party-sub">{form.email}</div>}
            </div>
          </div>

          <div className="ag-section">
            <h4>1. Equipment Being Listed for Sale</h4>
            <ul>
              <li><strong>Equipment:</strong> {form.name}</li>
              <li><strong>Category:</strong> {form.category}</li>
              <li><strong>Condition:</strong> {form.condition}</li>
              {form.year && <li><strong>Year:</strong> {form.year}</li>}
              {form.hours && <li><strong>Hours:</strong> {parseInt(form.hours).toLocaleString()} hrs</li>}
              <li><strong>Asking Price:</strong> N$ {parseInt(form.price||0).toLocaleString()} {form.negotiable ? "(Negotiable)" : "(Fixed)"}</li>
              <li><strong>Location:</strong> {form.location}, {form.region}</li>
              <li><strong>Listing Tier:</strong> {TIERS[tier]?.label} (N${TIERS[tier]?.price}/month)</li>
            </ul>
          </div>

          <div className="ag-section">
            <h4>2. Seller's Warranties &amp; Title Guarantee</h4>
            <ul>
              <li>The Seller warrants they hold <strong>clear, unencumbered title</strong> to the equipment and have the full legal right to sell it.</li>
              <li>The Seller confirms the equipment is <strong>free of all mortgages, liens, charges, hire purchase agreements, and financial encumbrances</strong>, unless disclosed in writing to BLC prior to listing.</li>
              <li>The Seller warrants that all information in the listing — including year, hours, condition, and specifications — is <strong>accurate, complete, and not misleading</strong>.</li>
              <li>The Seller confirms the equipment has <strong>not been reported stolen</strong> and is not subject to any court order, attachment, or execution.</li>
              <li>The Seller accepts that BLC will rely on these warranties and that any breach constitutes a material breach of this agreement.</li>
              <li>The Seller must disclose any known defects, accidents, damage history, or modifications that may affect the value or safety of the equipment.</li>
            </ul>
          </div>

          <div className="ag-section">
            <h4>3. BLC's Role — Platform &amp; Facilitation Only</h4>
            <ul>
              <li>BLC acts as a <strong>listing platform and facilitator</strong> only. BLC is not an agent, broker, or party to the sale transaction.</li>
              <li>BLC does not represent, warrant, or guarantee the equipment's condition, value, or fitness for purpose to any Buyer.</li>
              <li>The <strong>sale contract is directly between the Seller and the Buyer</strong>. BLC's role is to connect the parties and facilitate communication.</li>
              <li>BLC reserves the right to remove any listing that contains false information, violates platform rules, or is otherwise inappropriate.</li>
              <li>BLC does not handle sale proceeds. All payments are transacted directly between Seller and Buyer.</li>
            </ul>
          </div>

          <div className="ag-section">
            <h4>4. Listing Fees</h4>
            <ul>
              <li>The Seller agrees to pay BLC a <strong>listing fee of N$ {TIERS[tier]?.price}/month</strong> for the selected tier ({TIERS[tier]?.label}).</li>
              <li>Listing fees are payable to Bank Windhoek, Account 8052167764, Branch 486-372, reference PLANTHIRE-[Seller Name].</li>
              <li>Listing fees are <strong>non-refundable</strong> once the listing has been published.</li>
              <li>BLC charges <strong>no commission</strong> on the sale price unless a separate commission agreement has been signed.</li>
            </ul>
          </div>

          <div className="ag-section">
            <h4>5. Price, Negotiation &amp; Sale Process</h4>
            <ul>
              <li>The Seller sets the asking price and may indicate whether it is negotiable. BLC does not set or approve the asking price.</li>
              <li>Any negotiation of price is conducted solely between Seller and Buyer. BLC plays no role in price negotiation.</li>
              <li>The Seller must not mislead Buyers about the price, availability of financing, or any other material term of the sale.</li>
              <li>Once a sale is agreed between Seller and Buyer, the Seller must notify BLC so the listing can be marked <strong>SOLD</strong>.</li>
              <li>The Seller must remove or update the listing immediately if the equipment is sold through another channel.</li>
            </ul>
          </div>

          <div className="ag-section">
            <h4>6. Transfer of Ownership &amp; Documentation</h4>
            <ul>
              <li>The Seller is responsible for ensuring a <strong>legally valid transfer of ownership</strong> to the Buyer, including provision of title documents, registration papers, service history, and any other documentation required by Namibian law.</li>
              <li>The Seller must provide a <strong>receipt and proof of sale</strong> to the Buyer upon completion of the transaction.</li>
              <li>Any applicable transfer duties, fees, or taxes are the responsibility of the parties to the sale as agreed between them.</li>
              <li>The Seller must ensure the equipment is <strong>free of all encumbrances at the time of transfer</strong>. If any financier holds a charge over the equipment, the Seller must settle all outstanding finance before or simultaneous with transfer.</li>
            </ul>
          </div>

          <div className="ag-section">
            <h4>7. Inspection &amp; Viewing</h4>
            <ul>
              <li>The Seller agrees to make the equipment available for <strong>reasonable inspection by prospective Buyers</strong> at mutually agreed times.</li>
              <li>The Seller is responsible for safety during any site visit by prospective Buyers, including compliance with applicable site access and safety requirements.</li>
              <li>BLC may arrange inspections on behalf of interested Buyers. The Seller grants BLC permission to co-ordinate such visits.</li>
              <li>If the equipment requires a demonstration run, the Seller must provide a qualified operator and ensure all necessary safety precautions are taken.</li>
            </ul>
          </div>

          <div className="ag-section">
            <h4>8. Misrepresentation &amp; Liability</h4>
            <ul>
              <li>If the Seller provides false, inaccurate, or misleading information in their listing, the Seller is <strong>solely liable</strong> to any Buyer who suffers loss as a result.</li>
              <li>The Seller indemnifies BLC in full against any claim, loss, cost, or penalty arising from the Seller's misrepresentation or non-disclosure.</li>
              <li>BLC's liability to the Seller is limited to a refund of the current month's listing fee in all circumstances.</li>
              <li>BLC will co-operate with Namibian law enforcement authorities in the event of fraud or suspected criminal activity relating to any listing.</li>
            </ul>
          </div>

          <div className="ag-section">
            <h4>9. Prohibited Listings</h4>
            <ul>
              <li>The Seller must not list stolen equipment, equipment subject to a court interdict, or equipment they do not own or have authority to sell.</li>
              <li>The Seller must not list equipment that is illegal to own or operate in Namibia.</li>
              <li>The Seller must not use the platform to launder money, evade tax, or conduct any other fraudulent or illegal activity.</li>
              <li>Breach of this clause may result in criminal referral to Namibian Police and permanent ban from the platform.</li>
            </ul>
          </div>

          <div className="ag-section">
            <h4>10. Intellectual Property</h4>
            <ul>
              <li>The Seller grants BLC a non-exclusive, royalty-free licence to use listing photos and content for display and promotional purposes on the platform.</li>
              <li>The Seller warrants all submitted photos are their own original work and do not infringe third-party rights.</li>
              <li>This licence terminates when the listing is removed from the platform.</li>
            </ul>
          </div>

          <div className="ag-section">
            <h4>11. After-Sale Obligations</h4>
            <ul>
              <li>After a sale is completed, the Seller must notify BLC within 24 hours to allow the listing to be marked SOLD.</li>
              <li>The Seller must not continue to advertise or accept offers on equipment that has already been sold.</li>
              <li>Any after-sale disputes between Seller and Buyer (including claims for latent defects) are the sole responsibility of the Seller. BLC provides no warranty or guarantee on any equipment sold through the platform.</li>
            </ul>
          </div>

          <div className="ag-section">
            <h4>12. Governing Law &amp; Dispute Resolution</h4>
            <ul>
              <li>This agreement is governed by the <strong>laws of the Republic of Namibia</strong>.</li>
              <li>Disputes between BLC and the Seller shall be referred first to mediation, and if unresolved, to arbitration under the <strong>Arbitration Act of Namibia</strong>.</li>
              <li>Both parties consent to the jurisdiction of the <strong>High Court of Namibia, Main Division</strong>.</li>
            </ul>
          </div>

          <div style={{marginTop:16,padding:"12px 16px",background:"rgba(34,160,144,.08)",border:"1px solid var(--teal-light)",borderRadius:3,fontSize:11,color:"var(--sand)",lineHeight:1.7}}>
            <strong style={{color:"var(--teal-light)"}}>IMPORTANT:</strong> By accepting electronically, the Seller confirms title to the equipment, accepts all obligations above, and authorises BLC to publish this sale listing on the platform.
          </div>
        </div>

        <div className="agreement-footer">
          <div style={{fontFamily:"Oswald,sans-serif",fontSize:14,color:"var(--ivory)",letterSpacing:"1px",marginBottom:14}}>SELLER ACCEPTANCE</div>
          {[
            [ag1,setAg1,"ag_s1","I confirm I am the lawful owner of this equipment, hold clear unencumbered title, and have full authority to sell it."],
            [ag2,setAg2,"ag_s2","I warrant that all listing information is accurate, complete, and not misleading, and I have disclosed all known defects."],
            [ag3,setAg3,"ag_s3","I confirm the equipment is free of all finance, liens, mortgages, and encumbrances, or have disclosed these to BLC in writing."],
            [ag4,setAg4,"ag_s4","I accept that BLC is a facilitator only and not a party to the sale. I am solely responsible for the transfer of ownership and all legal documentation."],
            [ag5,setAg5,"ag_s5","I agree to mark the listing as SOLD immediately upon completion of sale and not to accept further offers after a sale is concluded."],
            [ag6,setAg6,"ag_s6","I accept the listing fee structure and acknowledge listing fees are non-refundable once published."],
            [ag7,setAg7,"ag_s7","I indemnify BLC in full against any claims arising from misrepresentation, false information, or breach of my obligations under this agreement."],
          ].map(([val,setter,id,text])=>(
            <div className="agree-checkbox-row" key={id}>
              <input type="checkbox" id={id} checked={val} onChange={e=>setter(e.target.checked)} />
              <label htmlFor={id}>{text}</label>
            </div>
          ))}
          <div className="sig-row" style={{marginTop:16}}>
            <div className="sig-box">
              <div className="sig-label">Seller Electronic Signature</div>
              <input className="sig-input" placeholder="Type your full name to sign..." value={sig} onChange={e=>setSig(e.target.value)} />
              <div style={{fontSize:10,color:"var(--bark)",marginTop:6}}>{today}</div>
            </div>
            <div className="sig-box">
              <div className="sig-label">For BLC Suppliers &amp; Trading</div>
              <div style={{fontFamily:"Lato,sans-serif",fontSize:14,fontStyle:"italic",color:"var(--ivory)",borderBottom:"1px solid var(--clay)",paddingBottom:4,marginBottom:4}}>Bertus Christiaan</div>
              <div style={{fontSize:10,color:"var(--bark)"}}>Managing Director · CC/2017/00361</div>
            </div>
          </div>
          <button className="btn-sale" style={{width:"100%",justifyContent:"center",padding:"14px",marginTop:4,opacity:canSign?1:.45}}
            onClick={() => { if(!canSign){alert("Please tick all boxes and type your full name.");return;} onAccept(sig); }}>
            ✅ Accept Agreement & Submit Sale Listing
          </button>
          {!canSign && <p style={{fontSize:11,color:"var(--bark)",marginTop:8,textAlign:"center"}}>Tick all checkboxes and type your full name to enable submission.</p>}
          <button className="btn-outline" style={{width:"100%",justifyContent:"center",padding:"10px",marginTop:8}} onClick={onBack}>← Back to Form</button>
        </div>
      </div>
    </div>
  );
}

function SubmitPage({ onSubmitted }) {
  const [step, setStep] = useState("pricing"); // pricing | form | agreement | done
  const [selectedTier, setSelectedTier] = useState("free");
  const [listingType, setListingType] = useState("hire");
  const [form, setForm] = useState({ name:"",category:"Excavator",region:"Khomas",location:"",price:"",unit:"day",condition:"Good",year:"",hours:"",contact:"",email:"",description:"",negotiable:false });
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const isSale = listingType === "sale";
  const tierData = TIERS[selectedTier];
  const maxPhotos = tierData.photos;
  const agreeRef = useRef();

  const pick = key => { setSelectedTier(key); const nm=TIERS[key].photos; if(images.length>nm) setImages(images.slice(0,nm)); setStep("form"); };

  const proceedToAgreement = () => {
    if (!form.name||!form.location||!form.price||!form.contact||!form.description) { alert("Please fill in all required fields (*)."); return; }
    setStep("agreement");
    setTimeout(() => agreeRef.current?.scrollIntoView({behavior:"smooth"}), 100);
  };

  const submitWithSignature = (sig) => {
    setLoading(true);
    setTimeout(() => {
      const all = loadListings();
      saveListings([...all,{
        ...form, listingType, tier:selectedTier,
        images:images.slice(0,maxPhotos),
        id:`u_${Date.now()}`, status:"pending",
        featured:tierData.featured, submittedAt:Date.now(),
        negotiable:form.negotiable,
        ownerAgreementAccepted:true,
        ownerAgreementDate:new Date().toISOString(),
        ownerSignature:sig
      }]);
      setLoading(false);
      onSubmitted(isSale, selectedTier);
    }, 800);
  };

  if (step === "pricing") return <PricingPage onSelect={pick} />;

  // Step indicator
  const steps = [["1","Details",step==="form"],["2","Agreement",step==="agreement"]];

  if (step === "agreement") {
    return (
      <div className="submit-page" ref={agreeRef}>
        <div style={{display:"flex",gap:0,marginBottom:20}}>
          {steps.map(([n,l,active],i)=>(
            <div key={n} className={`owner-step-ind${step==="agreement"&&i===0?" done":active?" active":""}`} style={{flex:1,padding:"8px",textAlign:"center",fontSize:"10px",fontWeight:700,letterSpacing:"1px",textTransform:"uppercase",borderBottom:`2px solid ${step==="agreement"&&i===0?"var(--green-ok)":active?"var(--teal-light)":"var(--clay)"}`,color:step==="agreement"&&i===0?"#81c784":active?"var(--teal-light)":"var(--bark)",transition:"all .2s"}}>
              {n}. {l}
            </div>
          ))}
        </div>
        {!isSale
          ? <OwnerHireAgreement form={form} tier={selectedTier} onAccept={submitWithSignature} onBack={()=>setStep("form")} />
          : <OwnerSaleAgreement form={form} tier={selectedTier} onAccept={submitWithSignature} onBack={()=>setStep("form")} />
        }
      </div>
    );
  }

  return (
    <div className="submit-page">
      {/* Step indicator */}
      <div style={{display:"flex",gap:0,marginBottom:20}}>
        {steps.map(([n,l,active])=>(
          <div key={n} className={`owner-step-ind${active?" active":""}`} style={{flex:1,padding:"8px",textAlign:"center",fontSize:"10px",fontWeight:700,letterSpacing:"1px",textTransform:"uppercase",borderBottom:`2px solid ${active?"var(--savanna)":"var(--clay)"}`,color:active?"var(--horizon)":"var(--bark)",transition:"all .2s"}}>
            {n}. {l}
          </div>
        ))}
      </div>
      <div className="form-card">
        <div className="form-title">LIST YOUR EQUIPMENT</div>
        <div className="form-subtitle">Fill in your details. You will sign the listing agreement in the next step before submission.</div>
        <div className={`selected-tier-banner ${selectedTier}`}>
          <span className="stb-icon">{selectedTier==="premium"?"⭐":selectedTier==="featured"?"★":"📋"}</span>
          <div><div className={`stb-label ${selectedTier}`}>{tierData.label} Listing</div><div className="stb-desc">{tierData.priceLabel} · {maxPhotos} photo{maxPhotos>1?"s":""}</div></div>
          <button className="stb-change" onClick={() => setStep("pricing")}>← Change</button>
        </div>
        <div className="type-selector">
          <div className={`type-opt${!isSale?" hs":""}`} onClick={()=>setListingType("hire")}><div className="type-opt-icon">🔑</div><div className="type-opt-title">For Hire</div><div className="type-opt-desc">Rent by hour, day, week or month</div></div>
          <div className={`type-opt${isSale?" ss":""}`} onClick={()=>setListingType("sale")}><div className="type-opt-icon">🏷️</div><div className="type-opt-title">For Sale</div><div className="type-opt-desc">Sell your machine outright</div></div>
        </div>
        {selectedTier !== "free" && <div className="submit-notice">💳 <strong>Payment required:</strong> Transfer <strong>N$ {tierData.price}</strong> to Bank Windhoek account <strong>{BLC_BANK.account}</strong> (Branch: {BLC_BANK.branch}), reference <strong>PLANTHIRE-[YOUR NAME]</strong>.</div>}
        <div className="form-row">
          <div className="fg"><label className={isSale?"sl":""}>Equipment Name *</label><input placeholder="e.g. CAT 320 Excavator 2019" value={form.name} onChange={e=>set("name",e.target.value)} /></div>
          <div className="fg"><label className={isSale?"sl":""}>Category *</label><select value={form.category} onChange={e=>set("category",e.target.value)}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></div>
        </div>
        <div className="form-row">
          <div className="fg"><label className={isSale?"sl":""}>Region *</label><select value={form.region} onChange={e=>set("region",e.target.value)}>{REGIONS.map(r=><option key={r}>{r}</option>)}</select></div>
          <div className="fg"><label className={isSale?"sl":""}>Town / Area *</label><input placeholder="e.g. Windhoek" value={form.location} onChange={e=>set("location",e.target.value)} /></div>
        </div>
        <div className="form-row">
          <div className="fg"><label className={isSale?"sl":""}>{isSale?"Asking Price (N$) *":"Hire Rate (N$) *"}</label><input type="number" placeholder={isSale?"2500000":"4500"} value={form.price} onChange={e=>set("price",e.target.value)} /></div>
          {!isSale ? (
            <div className="fg"><label>Rate Per</label><select value={form.unit} onChange={e=>set("unit",e.target.value)}><option value="hour">Hour</option><option value="day">Day</option><option value="week">Week</option><option value="month">Month</option></select></div>
          ) : (
            <div className="fg" style={{justifyContent:"flex-end"}}><label className="sl" style={{marginBottom:10}}>Price Flexibility</label><div className="chk-row"><input type="checkbox" id="nego" checked={form.negotiable} onChange={e=>set("negotiable",e.target.checked)}/><label htmlFor="nego">Price is negotiable</label></div></div>
          )}
        </div>
        <div className="form-row">
          <div className="fg"><label className={isSale?"sl":""}>Year of Manufacture</label><input type="number" placeholder="2018" value={form.year} onChange={e=>set("year",e.target.value)} /></div>
          <div className="fg"><label className={isSale?"sl":""}>Machine Hours</label><input type="number" placeholder="3500" value={form.hours} onChange={e=>set("hours",e.target.value)} /></div>
        </div>
        <div className="form-row">
          <div className="fg"><label className={isSale?"sl":""}>Condition *</label><select value={form.condition} onChange={e=>set("condition",e.target.value)}>{CONDITION.map(c=><option key={c}>{c}</option>)}</select></div>
          <div className="fg"><label className={isSale?"sl":""}>Contact Number *</label><input placeholder="+264 81 XXX XXXX" value={form.contact} onChange={e=>set("contact",e.target.value)} /></div>
        </div>
        <div className="form-row" style={{marginBottom:16}}>
          <div className="fg"><label className={isSale?"sl":""}>Email Address (optional)</label><input type="email" placeholder="your@email.com" value={form.email} onChange={e=>set("email",e.target.value)} /></div>
        </div>
        <div className="fg" style={{marginBottom:16}}>
          <label className={isSale?"sl":""}>Description *</label>
          <textarea rows={4} placeholder={isSale?"Describe: specs, service history, reason for selling...":"Describe: capacity, attachments, availability, operator included..."} value={form.description} onChange={e=>set("description",e.target.value)} />
        </div>
        <div className="fg" style={{marginBottom:28}}>
          <label className={isSale?"sl":""}>Photos ({maxPhotos} allowed on {tierData.label} tier)</label>
          <ImageUpload images={images} onChange={setImages} maxPhotos={maxPhotos} />
        </div>
        <button className={isSale?"btn-sale":"btn-primary"} style={{width:"100%",justifyContent:"center",padding:"16px",fontSize:14}} onClick={proceedToAgreement} disabled={loading}>
          {loading?"⏳ Submitting...": `Next: Review & Sign ${isSale?"Sale":"Hire"} Agreement →`}
        </button>
        <p style={{fontSize:11,color:"var(--bark)",marginTop:8,textAlign:"center"}}>You will review and sign the listing agreement before submission.</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARE MODAL — Premium Traffic Booster
// ─────────────────────────────────────────────────────────────────────────────
function ShareModal({ listing, onClose }) {
  const [copied, setCopied] = useState(false);
  const [captionCopied, setCaptionCopied] = useState(false);

  // Build a shareable URL — uses current page URL + listing ID as hash
  const baseUrl = typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}` : "https://blcplanthire.com";
  const shareUrl = `${baseUrl}#listing-${listing.id}`;
  const isSale = listing.listingType === "sale";
  const price = `N$ ${parseInt(listing.price).toLocaleString()}${isSale ? (listing.negotiable ? " (neg.)" : "") : ` per ${listing.unit}`}`;

  const caption = `🏗️ ${isSale ? "FOR SALE" : "FOR HIRE"}: ${listing.name}
📍 ${listing.location}, ${listing.region}, Namibia
💰 ${price}
${listing.condition ? `🔎 Condition: ${listing.condition}` : ""}${listing.year ? `\n📅 Year: ${listing.year}` : ""}${listing.hours ? `\n⏱ Hours: ${parseInt(listing.hours).toLocaleString()}` : ""}

${listing.description}

🔗 View listing: ${shareUrl}
📞 Enquire: +264 81 603 4139
✉ blc.bertus@gmail.com

⭐ Premium listing on BLC Plant Hire — Namibia's Plant Platform
#Namibia #PlantHire #Construction #HeavyEquipment #${listing.category.replace(/[^a-zA-Z]/g,"")} #BLC`;

  const encodedCaption = encodeURIComponent(caption);
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(`${isSale?"FOR SALE":"FOR HIRE"}: ${listing.name} — BLC Plant Hire Namibia`);

  const platforms = [
    { label:"Facebook",  emoji:"📘", cls:"share-fb", url:`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedCaption}` },
    { label:"WhatsApp",  emoji:"💬", cls:"share-wa", url:`https://wa.me/?text=${encodedCaption}` },
    { label:"X / Twitter",emoji:"🐦",cls:"share-x",  url:`https://twitter.com/intent/tweet?text=${encodeURIComponent(`${isSale?"FOR SALE":"FOR HIRE"}: ${listing.name} — ${price}\n${listing.location}, Namibia\n`)}&url=${encodedUrl}` },
    { label:"LinkedIn",  emoji:"💼", cls:"share-li", url:`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}&title=${encodedTitle}&summary=${encodedCaption}` },
  ];

  const copyUrl = () => {
    navigator.clipboard?.writeText(shareUrl).catch(()=>{});
    setCopied(true); setTimeout(()=>setCopied(false), 2500);
  };

  const copyCaption = () => {
    navigator.clipboard?.writeText(caption).catch(()=>{});
    setCaptionCopied(true); setTimeout(()=>setCaptionCopied(false), 2500);
  };

  // Track share event
  useEffect(() => { trackEvent("premium_share_opened", { listingId: listing.id }); }, []);

  return (
    <div className="share-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="share-modal">
        <button className="share-modal-close" onClick={onClose}>✕</button>

        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
          <div style={{fontSize:24}}>🚀</div>
          <div>
            <div style={{fontFamily:"Oswald,sans-serif",fontSize:20,letterSpacing:"1.5px",color:"var(--teal-light)"}}>TRAFFIC BOOSTER</div>
            <div style={{fontSize:11,color:"var(--sand)"}}>⭐ Premium Exclusive — Share your listing across social media</div>
          </div>
        </div>

        <div style={{background:"var(--soil)",border:"1px solid var(--clay)",borderRadius:4,padding:"12px 14px",marginBottom:16,display:"flex",gap:12,alignItems:"center"}}>
          {(listing.images||[]).length > 0 && <img src={listing.images[0]} alt="" style={{width:52,height:52,objectFit:"cover",borderRadius:3,flexShrink:0,border:"1px solid var(--clay)"}} />}
          <div>
            <div style={{fontWeight:700,fontSize:13,color:"var(--ivory)"}}>{listing.name}</div>
            <div style={{fontSize:11,color:"var(--sand)"}}>{listing.category} · {listing.location}, {listing.region}</div>
            <div style={{fontFamily:"Oswald,sans-serif",fontSize:14,color:"var(--horizon)",marginTop:2}}>{price}</div>
          </div>
        </div>

        {/* Shareable URL */}
        <div style={{fontSize:9,fontWeight:700,letterSpacing:"2px",textTransform:"uppercase",color:"var(--dune)",marginBottom:6}}>Shareable Link</div>
        <div className="share-url-box">
          <span className="share-url-text">{shareUrl}</span>
          <button className="share-url-copy" onClick={copyUrl}>{copied ? "✓ Copied!" : "Copy Link"}</button>
        </div>

        {/* Social platforms */}
        <div style={{fontSize:9,fontWeight:700,letterSpacing:"2px",textTransform:"uppercase",color:"var(--dune)",marginBottom:8}}>Share on Social Media</div>
        <div className="share-btns">
          {platforms.map(p => (
            <a key={p.label} href={p.url} target="_blank" rel="noreferrer" className={`share-btn ${p.cls}`}
              onClick={() => trackEvent("social_share", { platform: p.label, listingId: listing.id })}>
              {p.emoji} {p.label}
            </a>
          ))}
        </div>

        {/* Ready-made caption */}
        <div style={{fontSize:9,fontWeight:700,letterSpacing:"2px",textTransform:"uppercase",color:"var(--dune)",marginBottom:6}}>
          Ready-Made Post Caption
          <button onClick={copyCaption} style={{marginLeft:10,background:captionCopied?"var(--green-ok)":"var(--clay)",color:captionCopied?"#fff":"var(--dust)",border:"none",padding:"3px 10px",borderRadius:2,fontSize:9,fontWeight:700,cursor:"pointer",letterSpacing:"1px",textTransform:"uppercase"}}>
            {captionCopied ? "✓ Copied!" : "Copy Caption"}
          </button>
        </div>
        <div className="share-caption" style={{maxHeight:140,overflowY:"auto"}}>{caption}</div>

        {/* Tips */}
        <div style={{background:"rgba(34,160,144,.06)",border:"1px solid rgba(34,160,144,.2)",borderRadius:3,padding:"11px 14px",fontSize:11,color:"var(--sand)",lineHeight:1.7}}>
          <strong style={{color:"var(--teal-light)"}}>💡 Tips to maximise reach:</strong><br/>
          • Post to <strong>Facebook Groups</strong> for Namibian construction &amp; mining<br/>
          • Send to your <strong>WhatsApp contacts &amp; business groups</strong><br/>
          • Share on <strong>LinkedIn</strong> to reach project managers &amp; procurement officers<br/>
          • Re-share every <strong>3-4 days</strong> to stay visible in feeds
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TRAFFIC BOOSTER PANEL (inside Premium listing detail modal)
// ─────────────────────────────────────────────────────────────────────────────
function TrafficBoosterPanel({ listing, interests, bookings }) {
  const [showShare, setShowShare] = useState(false);
  const leadCount    = interests.filter(i => i.listingId === listing.id).length;
  const bookingCount = bookings.filter(b => b.listingId === listing.id).length;
  const shareCount   = (() => { try { const a = loadAnalytics(); return (a.events||[]).filter(e=>e.type==="social_share"&&e.meta?.listingId===listing.id).length; } catch{ return 0; } })();
  const viewCount    = (() => { try { const a = loadAnalytics(); return (a.events||[]).filter(e=>e.type==="listing_view"&&e.meta?.listingId===listing.id).length; } catch{ return 0; } })();

  return (
    <>
      <div className="boost-panel">
        <div className="boost-title">🚀 Traffic Booster <span style={{fontSize:10,background:"rgba(34,160,144,.2)",padding:"2px 8px",borderRadius:10,letterSpacing:"1px"}}>PREMIUM</span></div>
        <div className="boost-sub">Share your listing across social media to drive more enquiries. Your listing gets priority placement + this exclusive sharing kit.</div>

        <button className="btn-sale" style={{marginBottom:14,display:"flex",alignItems:"center",gap:8}} onClick={()=>setShowShare(true)}>
          🚀 Share & Boost This Listing
        </button>

        <div className="boost-stats">
          {[["👁",viewCount,"Views"],["👤",leadCount,"Leads"],["📅",bookingCount,"Bookings"],["📤",shareCount,"Shares"]].map(([ic,n,l])=>(
            <div key={l} style={{textAlign:"center"}}>
              <div className="boost-stat-n">{ic} {n}</div>
              <div className="boost-stat-l">{l}</div>
            </div>
          ))}
        </div>
      </div>
      {showShare && <ShareModal listing={listing} onClose={()=>setShowShare(false)} />}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function AnalyticsDashboard({ listings, bookings, interests, ads, chats, ratings }) {
  const [period, setPeriod] = useState("30"); // 7 | 30 | 90 | all

  const now = Date.now();
  const days = period === "all" ? 3650 : parseInt(period);
  const since = now - days * 86400000;
  const prevSince = now - days * 2 * 86400000;

  // ── HELPERS ──
  const inPeriod = ts => ts >= since;
  const inPrev   = ts => ts >= prevSince && ts < since;
  const fmtN     = n => n >= 1000000 ? `N$${(n/1000000).toFixed(1)}M` : n >= 1000 ? `N$${(n/1000).toFixed(0)}K` : `N$${n.toLocaleString()}`;
  const fmtNum   = n => n >= 1000 ? `${(n/1000).toFixed(1)}K` : n.toString();
  const trend    = (cur, prev) => prev === 0 ? null : Math.round(((cur-prev)/prev)*100);
  const trendEl  = (cur, prev) => { const t = trend(cur,prev); if (t===null) return null; return <span className={`kpi-trend ${t>0?"up":t<0?"down":"flat"}`}>{t>0?"▲":"▼"} {Math.abs(t)}% vs prev period</span>; };

  // ── CORE METRICS ──
  const approvedListings     = listings.filter(l => l.status === "approved");
  const newListings          = listings.filter(l => inPeriod(l.submittedAt));
  const prevNewListings      = listings.filter(l => inPrev(l.submittedAt));
  const confirmedBookings    = bookings.filter(b => b.status === "confirmed" && inPeriod(b.submittedAt));
  const prevConfirmed        = bookings.filter(b => b.status === "confirmed" && inPrev(b.submittedAt));
  const periodLeads          = interests.filter(i => inPeriod(i.timestamp));
  const prevLeads            = interests.filter(i => inPrev(i.timestamp));
  const bookingRevenue       = confirmedBookings.reduce((s,b) => s + (b.totalCost||0) * 1.15, 0); // incl VAT
  const prevBookingRevenue   = prevConfirmed.reduce((s,b) => s + (b.totalCost||0) * 1.15, 0);
  const activeAds            = ads.filter(a => a.active && new Date(a.endDate) >= new Date());
  const adRevenue            = activeAds.reduce((s,a) => s + (AD_SLOTS[a.slot]?.price||0), 0);
  const listingRevenue       = approvedListings.filter(l => l.tier && l.tier !== "free").reduce((s,l) => s + (TIERS[l.tier]?.price||0), 0);
  const totalRevenue         = bookingRevenue + adRevenue + listingRevenue;
  const conversionRate       = periodLeads.length > 0 ? Math.round((confirmedBookings.length / periodLeads.length)*100) : 0;
  const chatSessions         = Object.keys(chats).length;
  const totalRatings         = Object.values(ratings).reduce((s,arr) => s + arr.length, 0);
  const avgRatingAll         = totalRatings > 0 ? (Object.values(ratings).flatMap(a=>a).reduce((s,r)=>s+r.stars,0)/totalRatings).toFixed(1) : "—";

  // ── MONTHLY REVENUE BARS (last 6 months) ──
  const monthBars = Array.from({length:6}).map((_,i) => {
    const d = new Date(); d.setMonth(d.getMonth() - (5-i));
    const label = d.toLocaleString("en-NA",{month:"short"});
    const ms = d.getMonth(); const yr = d.getFullYear();
    const bRev = bookings.filter(b => { const bd=new Date(b.submittedAt); return bd.getMonth()===ms&&bd.getFullYear()===yr&&b.status==="confirmed"; }).reduce((s,b)=>s+(b.totalCost||0)*1.15,0);
    const lRev = approvedListings.filter(l => { const ld=new Date(l.submittedAt); return ld.getMonth()===ms&&ld.getFullYear()===yr&&l.tier&&l.tier!=="free"; }).reduce((s,l)=>s+(TIERS[l.tier]?.price||0),0);
    return { label, bookings: Math.round(bRev), listings: lRev, ads: adRevenue };
  });
  const maxBar = Math.max(...monthBars.map(b => b.bookings + b.listings + b.ads), 1);

  // ── LISTING BREAKDOWN PIE DATA ──
  const hirePct  = approvedListings.length ? Math.round(approvedListings.filter(l=>l.listingType==="hire").length/approvedListings.length*100) : 0;
  const salePct  = 100 - hirePct;
  const premPct  = approvedListings.length ? Math.round(approvedListings.filter(l=>l.tier==="premium").length/approvedListings.length*100) : 0;
  const featPct  = approvedListings.length ? Math.round(approvedListings.filter(l=>l.tier==="featured").length/approvedListings.length*100) : 0;
  const freePct  = 100 - premPct - featPct;

  // ── TOP PERFORMING LISTINGS ──
  const topListings = approvedListings.map(l => ({
    ...l,
    bookCount: bookings.filter(b=>b.listingId===l.id&&b.status==="confirmed").length,
    leadCount: interests.filter(i=>i.listingId===l.id).length,
    revenue: bookings.filter(b=>b.listingId===l.id&&b.status==="confirmed").reduce((s,b)=>s+(b.totalCost||0)*1.15,0),
    avgRat: avgRating(ratings, l.id),
  })).sort((a,b)=>b.revenue-a.revenue).slice(0,5);

  // ── RECENT ACTIVITY FEED ──
  const recentActivity = [
    ...bookings.filter(b=>inPeriod(b.submittedAt)).map(b=>({ ts:b.submittedAt, icon:"📅", color:"var(--teal-light)", title:`Booking ${b.status==="confirmed"?"confirmed":"request"}: ${b.listingName}`, meta:`${b.bookedBy?.name} · N$${(b.totalCost||0).toLocaleString()} · ${b.days} days` })),
    ...interests.filter(i=>inPeriod(i.timestamp)).map(i=>({ ts:i.timestamp, icon:"👤", color:"#6db3e8", title:`New lead: ${i.listingName}`, meta:`${i.name}${i.company?" — "+i.company:""} · ${i.phone}` })),
    ...listings.filter(l=>inPeriod(l.submittedAt)).map(l=>({ ts:l.submittedAt, icon:l.listingType==="sale"?"🏷":"🔑", color:"var(--savanna)", title:`New ${l.status} listing: ${l.name}`, meta:`${l.category} · ${l.region} · ${TIERS[l.tier]?.label||"Free"}` })),
  ].sort((a,b)=>b.ts-a.ts).slice(0,12);

  const fmtAgo = ts => { const m=Math.floor((now-ts)/60000); return m<60?`${m}m ago`:m<1440?`${Math.floor(m/60)}h ago`:`${Math.floor(m/1440)}d ago`; };

  // ── REVENUE PROJECTIONS ──
  const monthlyRecurring = adRevenue + listingRevenue;
  const avgBookingPerMonth = bookings.filter(b=>b.status==="confirmed").length > 0 ? (bookingRevenue / Math.max(days/30, 1)) : 0;
  const proj3 = (monthlyRecurring + avgBookingPerMonth) * 3;
  const proj6 = (monthlyRecurring + avgBookingPerMonth) * 6;
  const proj12 = (monthlyRecurring + avgBookingPerMonth) * 12;
  const potentialMax = (Object.values(AD_SLOTS).reduce((s,sl)=>s+sl.price*5,0) + Object.values(TIERS).reduce((s,t)=>s+t.price*10,0)) * 12;

  // ── DONUT SVG ──
  function Donut({ segments, size=120 }) {
    const r = (size-20)/2; const cx=size/2; const cy=size/2;
    const circ = 2*Math.PI*r;
    let offset = 0;
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {segments.map((seg,i) => {
          const dash = (seg.pct/100)*circ;
          const el = <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth="18" strokeDasharray={`${dash} ${circ-dash}`} strokeDashoffset={-offset} transform={`rotate(-90 ${cx} ${cy})`} />;
          offset += dash;
          return el;
        })}
        <text x={cx} y={cy+1} textAnchor="middle" dominantBaseline="middle" style={{fontSize:12,fill:"var(--ivory)",fontWeight:700}}>{segments[0]?.pct}%</text>
      </svg>
    );
  }

  return (
    <div className="analytics-page">
      <div className="analytics-header">
        <div className="analytics-title">ANALYTICS <span>DASHBOARD</span></div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <span style={{fontSize:11,color:"var(--bark)"}}>Period:</span>
          <div className="period-tabs">
            {[["7","7 Days"],["30","30 Days"],["90","90 Days"],["all","All Time"]].map(([v,l])=>(
              <button key={v} className={`period-tab${period===v?" active":""}`} onClick={()=>setPeriod(v)}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="kpi-grid">
        {[
          { cls:"revenue",   label:"Total Revenue",       val:fmtN(Math.round(totalRevenue)),      sub:"Bookings + ads + listings",       cur:Math.round(totalRevenue),       prev:Math.round(prevBookingRevenue) },
          { cls:"bookings",  label:"Booking Revenue",     val:fmtN(Math.round(bookingRevenue)),    sub:`${confirmedBookings.length} confirmed`,   cur:Math.round(bookingRevenue), prev:Math.round(prevBookingRevenue) },
          { cls:"ads-rev",   label:"Ad Revenue / Month",  val:fmtN(adRevenue),                     sub:`${activeAds.length} active ads`,          cur:adRevenue, prev:adRevenue },
          { cls:"listings",  label:"Listing Fees / Month",val:fmtN(listingRevenue),                sub:`${approvedListings.filter(l=>l.tier!=="free").length} paid tiers`, cur:listingRevenue, prev:listingRevenue },
          { cls:"leads",     label:"New Leads",           val:fmtNum(periodLeads.length),           sub:"Interest submissions",            cur:periodLeads.length,            prev:prevLeads.length },
          { cls:"bookings",  label:"Bookings",            val:confirmedBookings.length.toString(),  sub:"Confirmed in period",             cur:confirmedBookings.length,       prev:prevConfirmed.length },
          { cls:"listings",  label:"Active Listings",     val:approvedListings.length.toString(),   sub:`${newListings.length} new this period`,   cur:newListings.length, prev:prevNewListings.length },
          { cls:"conversion",label:"Conversion Rate",     val:`${conversionRate}%`,                 sub:"Leads → bookings",                cur:conversionRate, prev:0 },
          { cls:"leads",     label:"Avg Rating",          val:avgRatingAll==="—"?avgRatingAll:`${avgRatingAll}★`,sub:`${totalRatings} total reviews`,  cur:0, prev:0 },
          { cls:"revenue",   label:"Chat Sessions",       val:chatSessions.toString(),              sub:"Unique visitors chatted",         cur:chatSessions, prev:0 },
        ].map((k,i)=>(
          <div key={i} className={`kpi-card ${k.cls}`}>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value">{k.val}</div>
            <div className="kpi-sub">{k.sub}</div>
            {trendEl(k.cur, k.prev)}
          </div>
        ))}
      </div>

      {/* CHARTS ROW */}
      <div className="charts-grid">
        {/* Monthly Revenue Bar Chart */}
        <div className="chart-card">
          <div className="chart-title">Monthly Revenue Breakdown</div>
          <div className="chart-sub">Last 6 months — Bookings (amber) · Listings (teal) · Ads (gold)</div>
          <div className="bar-chart">
            {monthBars.map((m,i)=>(
              <div key={i} className="bar-wrap" style={{justifyContent:"flex-end"}}>
                <div className="bar-val">{m.bookings+m.listings+m.ads>0?`N$${((m.bookings+m.listings+m.ads)/1000).toFixed(0)}K`:"—"}</div>
                <div style={{width:"100%",display:"flex",flexDirection:"column",alignItems:"stretch",gap:1,flex:1,justifyContent:"flex-end"}}>
                  <div className="bar" style={{background:"var(--gold)",height:`${Math.round((m.ads/maxBar)*100)}%`}} title={`Ads: N$${m.ads}`} />
                  <div className="bar" style={{background:"var(--teal-light)",height:`${Math.round((m.listings/maxBar)*100)}%`}} title={`Listings: N$${m.listings}`} />
                  <div className="bar" style={{background:"var(--savanna)",height:`${Math.round((m.bookings/maxBar)*100)}%`}} title={`Bookings: N$${m.bookings}`} />
                </div>
                <div className="bar-label">{m.label}</div>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:16,marginTop:8,flexWrap:"wrap"}}>
            {[["var(--savanna)","Bookings"],["var(--teal-light)","Listings"],["var(--gold)","Ads"]].map(([c,l])=>(
              <div key={l} style={{display:"flex",alignItems:"center",gap:5,fontSize:10,color:"var(--sand)"}}>
                <div style={{width:10,height:10,borderRadius:2,background:c}}/>{l}
              </div>
            ))}
          </div>
        </div>

        {/* Listing Mix Donut */}
        <div className="chart-card">
          <div className="chart-title">Listing Mix</div>
          <div className="chart-sub">By type and tier</div>
          <div className="donut-wrap">
            <Donut segments={[{pct:hirePct,color:"var(--savanna)"},{pct:salePct,color:"var(--teal-light)"}]} />
            <div className="donut-legend">
              {[["var(--savanna)",`For Hire`,hirePct],["var(--teal-light)",`For Sale`,salePct],["var(--teal-light)",`Premium`,premPct],["var(--horizon)",`Featured`,featPct],["var(--clay)",`Free`,freePct]].map(([c,l,p])=>(
                <div key={l} className="donut-legend-item">
                  <div className="donut-dot" style={{background:c}}/>
                  <span style={{flex:1}}>{l}</span>
                  <span style={{color:"var(--sand)",fontWeight:700}}>{p}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* REVENUE PROJECTION */}
      <div className="revenue-projection">
        <div style={{fontFamily:"Oswald,sans-serif",fontSize:18,letterSpacing:"1.5px",color:"var(--ivory)",marginBottom:4}}>REVENUE PROJECTIONS</div>
        <div style={{fontSize:12,color:"var(--sand)"}}>Based on current recurring revenue (N${monthlyRecurring.toLocaleString()}/mo) + avg booking revenue (N${Math.round(avgBookingPerMonth).toLocaleString()}/mo)</div>
        <div className="proj-grid">
          <div className="proj-item">
            <div className="proj-label">Monthly Recurring</div>
            <div className="proj-value" style={{color:"var(--teal-light)"}}>N${monthlyRecurring.toLocaleString()}</div>
            <div className="proj-note">Ads + listing tiers, guaranteed</div>
          </div>
          <div className="proj-item">
            <div className="proj-label">3-Month Forecast</div>
            <div className="proj-value" style={{color:"var(--horizon)"}}>N${Math.round(proj3).toLocaleString()}</div>
            <div className="proj-note">At current trajectory</div>
          </div>
          <div className="proj-item">
            <div className="proj-label">6-Month Forecast</div>
            <div className="proj-value" style={{color:"var(--horizon)"}}>N${Math.round(proj6).toLocaleString()}</div>
            <div className="proj-note">At current trajectory</div>
          </div>
          <div className="proj-item">
            <div className="proj-label">12-Month Forecast</div>
            <div className="proj-value" style={{color:"var(--gold)"}}>N${Math.round(proj12).toLocaleString()}</div>
            <div className="proj-note">At current trajectory</div>
          </div>
          <div className="proj-item">
            <div className="proj-label">Max Annual Potential</div>
            <div className="proj-value" style={{color:"var(--gold)"}}>N${Math.round(potentialMax/1000)}K+</div>
            <div className="proj-note">5 advertisers/slot · 10 paid listings/tier</div>
          </div>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:24}}>
        {/* TOP LISTINGS */}
        <div className="chart-card">
          <div className="chart-title">Top Performing Listings</div>
          <div className="chart-sub">By confirmed booking revenue</div>
          {topListings.length === 0
            ? <div style={{color:"var(--bark)",fontSize:13,textAlign:"center",padding:"24px 0"}}>No confirmed bookings yet</div>
            : (
              <table className="top-table">
                <thead><tr><th>Equipment</th><th>Bookings</th><th>Leads</th><th>Revenue</th><th>Rating</th></tr></thead>
                <tbody>
                  {topListings.map(l=>(
                    <tr key={l.id}>
                      <td>
                        <div style={{fontWeight:700,fontSize:12}}>{l.name.length>22?l.name.slice(0,22)+"…":l.name}</div>
                        <div style={{fontSize:10,color:"var(--bark)"}}>{l.listingType==="hire"?"🔑":"🏷"} {l.category}</div>
                      </td>
                      <td><span style={{color:"var(--teal-light)",fontWeight:700}}>{l.bookCount}</span></td>
                      <td><span style={{color:"#6db3e8",fontWeight:700}}>{l.leadCount}</span></td>
                      <td><span style={{color:"var(--horizon)",fontFamily:"Oswald,sans-serif",fontSize:13}}>N${Math.round(l.revenue).toLocaleString()}</span></td>
                      <td><span style={{color:"var(--gold)"}}>{l.avgRat?`${l.avgRat}★`:"—"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        </div>

        {/* AD PERFORMANCE */}
        <div className="chart-card">
          <div className="chart-title">Ad Slot Performance</div>
          <div className="chart-sub">Active advertisers per slot · Revenue</div>
          <table className="top-table">
            <thead><tr><th>Slot</th><th>Advertisers</th><th>Revenue/Mo</th><th>Status</th></tr></thead>
            <tbody>
              {Object.values(AD_SLOTS).map(sl => {
                const slotAds = activeAds.filter(a=>a.slot===sl.id);
                const slotRev = slotAds.length * sl.price;
                return (
                  <tr key={sl.id}>
                    <td><div style={{fontWeight:700,fontSize:12}}>{sl.label}</div><div style={{fontSize:10,color:"var(--bark)"}}>{sl.size}</div></td>
                    <td><span style={{color:"var(--horizon)",fontWeight:700}}>{slotAds.length}</span></td>
                    <td><span style={{color:"var(--gold)",fontFamily:"Oswald,sans-serif",fontSize:13}}>N${slotRev.toLocaleString()}</span></td>
                    <td>
                      <span style={{fontSize:10,color:slotAds.length>0?"#81c784":"var(--bark)",fontWeight:700}}>
                        {slotAds.length>1?"🔄 Rotating":slotAds.length===1?"✅ Active":"⚫ Empty"}
                      </span>
                    </td>
                  </tr>
                );
              })}
              <tr style={{borderTop:"2px solid var(--clay)"}}>
                <td style={{fontWeight:700}}>TOTAL</td>
                <td><span style={{color:"var(--horizon)",fontWeight:700}}>{activeAds.length}</span></td>
                <td><span style={{color:"var(--gold)",fontFamily:"Oswald,sans-serif",fontSize:14,fontWeight:700}}>N${adRevenue.toLocaleString()}</span></td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* RECENT ACTIVITY FEED */}
      <div className="activity-feed">
        <div style={{fontFamily:"Oswald,sans-serif",fontSize:18,letterSpacing:"1.5px",color:"var(--ivory)",marginBottom:4}}>LIVE ACTIVITY FEED</div>
        <div style={{fontSize:11,color:"var(--bark)",marginBottom:16}}>Most recent platform activity</div>
        {recentActivity.length === 0
          ? <div style={{color:"var(--bark)",fontSize:13,textAlign:"center",padding:"24px 0"}}>No activity recorded yet. Activity will populate as users interact with the platform.</div>
          : recentActivity.map((a,i)=>(
            <div key={i} className="activity-item">
              <div className="activity-icon" style={{background:`${a.color}22`,border:`1px solid ${a.color}44`}}>{a.icon}</div>
              <div className="activity-text">
                <div className="activity-title">{a.title}</div>
                <div className="activity-meta">{a.meta} · {fmtAgo(a.ts)}</div>
              </div>
            </div>
          ))
        }
      </div>

      {/* REGIONAL BREAKDOWN */}
      <div className="chart-card" style={{marginBottom:24}}>
        <div className="chart-title">Regional Distribution</div>
        <div className="chart-sub">Approved listings by Namibian region</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:8,marginTop:12}}>
          {REGIONS.map(r => {
            const count = approvedListings.filter(l=>l.region===r).length;
            const pct = approvedListings.length ? Math.round(count/approvedListings.length*100) : 0;
            return (
              <div key={r} style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{flex:1}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                    <span style={{fontSize:11,color:"var(--dust)"}}>{r}</span>
                    <span style={{fontSize:11,color:"var(--sand)",fontWeight:700}}>{count}</span>
                  </div>
                  <div style={{height:4,background:"var(--clay)",borderRadius:2,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${pct}%`,background:"var(--savanna)",borderRadius:2,transition:"width .5s"}} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BLC LOGO — uploaded CAT excavator artwork (base64 embedded)
// ─────────────────────────────────────────────────────────────────────────────
const BLC_LOGO_SRC = "data:image/png;base64,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";

function BlcLogoMark({ size = 56 }) {
  return (
    <img
      src={BLC_LOGO_SRC}
      alt="BLC Plant Hire"
      style={{
        height: `${size}px`,
        width: 'auto',
        flexShrink: 0,
        objectFit: "contain",
        display: "block",
        filter: "drop-shadow(0 2px 6px rgba(0,0,0,.5))"
      }}
    />
  );
}

function BlcLogoFull({ size = 220 }) {
  return (
    <img
      src={BLC_LOGO_SRC}
      alt="BLC Plant Hire"
      style={{
        height: `${size}px`,
        width: 'auto',
        objectFit: "contain",
        display: "block",
        margin: "0 auto",
        filter: "drop-shadow(0 2px 8px rgba(0,0,0,.4))"
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LANGUAGE PICKER
// ─────────────────────────────────────────────────────────────────────────────
function LanguagePicker({ lang, onChange }) {
  const [open, setOpen] = useState(false);
  const current = LANGUAGES[lang] || LANGUAGES.en;
  useEffect(() => {
    const close = () => setOpen(false);
    if (open) { setTimeout(() => window.addEventListener("click", close), 0); return () => window.removeEventListener("click", close); }
  }, [open]);
  return (
    <div className="lang-picker" onClick={e => { e.stopPropagation(); setOpen(!open); }}>
      <span>{current.flag}</span>
      <span>{current.code.toUpperCase()}</span>
      <span style={{fontSize:8,opacity:.6}}>▼</span>
      {open && (
        <div className="lang-dropdown" onClick={e => e.stopPropagation()}>
          {Object.values(LANGUAGES).map(l => (
            <button key={l.code} className={`lang-opt${l.code===lang?" active":""}`}
              onClick={() => { onChange(l.code); setOpen(false); }}>
              <span>{l.flag}</span> {l.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SMS NOTIFICATIONS PANEL
// ─────────────────────────────────────────────────────────────────────────────
function SmsNotificationsPanel() {
  const [log, setLog] = useState(loadSmsLog);
  const [filter, setFilter] = useState("all");

  const filtered = filter === "all" ? log : log.filter(s => s.type === filter);
  const unsent = log.filter(s => !s.sent).length;

  const markSent = (id) => {
    const u = log.map(s => s.id===id ? {...s, sent:true, sentAt:Date.now()} : s);
    setLog(u); saveSmsLog(u);
  };

  const sendNow = (sms) => {
    sendSms(sms.phone, sms.message);
    markSent(sms.id);
  };

  const clearAll = () => {
    if (!window.confirm("Clear all SMS history? (Unsent messages will be lost)")) return;
    setLog([]); saveSmsLog([]);
  };

  const fmt = ts => new Date(ts).toLocaleString("en-NA",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
  const types = ["all","booking_confirmed","booking_pending","listing_approved","listing_rejected","ad_approved","ad_rejected","new_lead_to_owner"];

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12,marginBottom:20}}>
        <div>
          <div style={{fontFamily:"Oswald,sans-serif",fontSize:22,letterSpacing:"1.5px",color:"var(--ivory)"}}>📱 SMS NOTIFICATIONS</div>
          <div style={{fontSize:11,color:"var(--sand)",marginTop:4}}>Send SMS alerts directly to customers via your phone. Tap "Send" to open your SMS app with the message pre-filled.</div>
        </div>
        {unsent > 0 && <span style={{background:"#ef4444",color:"#fff",padding:"4px 12px",borderRadius:10,fontSize:11,fontWeight:700}}>{unsent} unsent</span>}
      </div>

      {/* Stats */}
      <div className="revenue-summary" style={{marginBottom:20}}>
        <div className="rev-item"><div className="rev-num">{log.length}</div><div className="rev-label">Total Queued</div></div>
        <div className="rev-item"><div className="rev-num green">{log.filter(s=>s.sent).length}</div><div className="rev-label">Sent</div></div>
        <div className="rev-item"><div className="rev-num" style={{color:"var(--horizon)"}}>{unsent}</div><div className="rev-label">Pending</div></div>
      </div>

      {/* Info card */}
      <div style={{background:"rgba(34,160,144,.08)",border:"1px solid var(--teal-light)",borderRadius:4,padding:"14px 18px",marginBottom:20,fontSize:12,color:"var(--sand)",lineHeight:1.7}}>
        <strong style={{color:"var(--teal-light)"}}>💡 How it works:</strong> When you confirm a booking, approve an ad, or take any action, BLC auto-queues an SMS notification here.
        Click <strong>📤 Send Now</strong> to open your phone's SMS app with the message pre-filled — just tap send.
        To send automatically via an SMS gateway (bulk, scheduled), integrate with an SMS API like <strong>MTC Business SMS</strong> or <strong>Clickatell Namibia</strong>.
      </div>

      {/* Filter tabs */}
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
        {types.map(ty => (
          <button key={ty} className={`admin-tab${filter===ty?" active":""}`} onClick={()=>setFilter(ty)} style={{fontSize:10}}>
            {ty === "all" ? "All" : ty.replace(/_/g," ").replace(/\b\w/g,l=>l.toUpperCase())}
          </button>
        ))}
        {log.length > 0 && <button className="btn-muted" onClick={clearAll} style={{marginLeft:"auto"}}>🗑 Clear All</button>}
      </div>

      {/* SMS log */}
      {filtered.length === 0 ? (
        <div className="empty"><div className="empty-icon">📱</div><h3>No SMS notifications yet</h3><p>Booking confirmations, ad approvals, and listing updates will queue here automatically.</p></div>
      ) : (
        <div className="sms-panel">
          {filtered.slice().reverse().map(sms => (
            <div key={sms.id} className="sms-row">
              <div className="sms-icon">📱</div>
              <div style={{flex:1}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,marginBottom:4,flexWrap:"wrap"}}>
                  <strong style={{fontSize:12,color:"var(--ivory)"}}>{sms.phone}</strong>
                  <span className={`sms-badge ${sms.sent?"sms-sent":"sms-pending"}`}>{sms.sent?"✓ Sent":"Pending"}</span>
                </div>
                <div className="sms-msg">{sms.message}</div>
                <div className="sms-meta">{sms.type.replace(/_/g," ")} · {fmt(sms.ts)}{sms.sent&&sms.sentAt?` · Sent ${fmt(sms.sentAt)}`:""}</div>
              </div>
              {!sms.sent && (
                <button className="btn-primary" style={{padding:"6px 12px",fontSize:10}} onClick={()=>sendNow(sms)}>📤 Send</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BULK EQUIPMENT IMPORT (CSV)
// ─────────────────────────────────────────────────────────────────────────────
function BulkImportPanel({ listings, setListings }) {
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const fileRef = useRef();

  const csvTemplate = `name,category,region,location,price,unit,condition,year,hours,contact,email,description,listingType,tier,negotiable
Komatsu PC300 Excavator,Excavator,Khomas,Windhoek,5500,day,Good,2020,2400,+264 81 123 4567,hire@company.na,Heavy duty 30t excavator with bucket attachments,hire,premium,false
Volvo FMX 8x4 Tipper,Tipper Truck,Erongo,Walvis Bay,1800000,fixed,Excellent,2022,800,+264 81 234 5678,,Like-new tipper truck for sale,sale,featured,true`;

  const downloadTemplate = () => {
    const blob = new Blob([csvTemplate], { type:"text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "blc-plant-hire-template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = (files) => {
    if (!files.length) return;
    const reader = new FileReader();
    reader.onload = e => { setCsvText(e.target.result); parseCsv(e.target.result); };
    reader.readAsText(files[0]);
  };

  const parseCsv = (text) => {
    const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) { setPreview({ error:"CSV must have header row + at least one data row" }); return; }
    const headers = lines[0].split(",").map(h => h.trim());
    const required = ["name","category","region","location","price","contact"];
    const missing = required.filter(r => !headers.includes(r));
    if (missing.length) { setPreview({ error:`Missing required columns: ${missing.join(", ")}` }); return; }

    const rows = [];
    const errors = [];
    for (let i = 1; i < lines.length; i++) {
      // Simple CSV parse (handles basic commas, does not handle quoted commas)
      const vals = lines[i].split(",").map(v => v.trim());
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = vals[idx] || ""; });

      // Validate
      const rowErrors = [];
      if (!obj.name) rowErrors.push("missing name");
      if (!obj.category || !CATEGORIES.includes(obj.category)) rowErrors.push(`invalid category (must be one of: ${CATEGORIES.slice(0,5).join(", ")}...)`);
      if (!obj.region || !REGIONS.includes(obj.region)) rowErrors.push("invalid region");
      if (!obj.price || isNaN(parseInt(obj.price))) rowErrors.push("invalid price");
      if (!obj.contact) rowErrors.push("missing contact");
      if (obj.listingType && !["hire","sale"].includes(obj.listingType)) rowErrors.push("listingType must be 'hire' or 'sale'");
      if (obj.tier && !["free","featured","premium"].includes(obj.tier)) rowErrors.push("tier must be free/featured/premium");

      rows.push({ ...obj, _row: i+1, _valid: rowErrors.length === 0, _errors: rowErrors });
      if (rowErrors.length) errors.push({ row:i+1, errors:rowErrors });
    }
    setPreview({ rows, errors, total:rows.length, valid:rows.filter(r => r._valid).length });
  };

  const doImport = () => {
    if (!preview || preview.error || preview.valid === 0) return;
    const validRows = preview.rows.filter(r => r._valid);
    const newListings = validRows.map(r => ({
      id: `u_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
      name: r.name,
      category: r.category,
      region: r.region,
      location: r.location,
      price: r.price,
      unit: r.unit || "day",
      condition: r.condition || "Good",
      year: r.year || "",
      hours: r.hours || "",
      contact: r.contact,
      email: r.email || "",
      description: r.description || "",
      listingType: r.listingType || "hire",
      tier: r.tier || "free",
      negotiable: r.negotiable === "true",
      images: [],
      status: "pending",
      featured: (r.tier||"free") !== "free",
      submittedAt: Date.now(),
      bulkImported: true,
    }));
    const all = [...listings, ...newListings];
    setListings(all); saveListings(all);
    setImportResult({ count: newListings.length, skipped: preview.total - preview.valid });
    setCsvText(""); setPreview(null);
  };

  return (
    <div>
      <div style={{marginBottom:20}}>
        <div style={{fontFamily:"Oswald,sans-serif",fontSize:22,letterSpacing:"1.5px",color:"var(--ivory)"}}>📥 BULK EQUIPMENT IMPORT</div>
        <div style={{fontSize:12,color:"var(--sand)",marginTop:4}}>Import multiple equipment listings at once via CSV. Perfect for adding your existing fleet.</div>
      </div>

      {importResult && (
        <div style={{background:"rgba(46,125,50,.12)",border:"2px solid var(--green-ok)",borderRadius:4,padding:"16px 20px",marginBottom:20}}>
          <div style={{fontFamily:"Oswald,sans-serif",fontSize:18,color:"#81c784",letterSpacing:"1.5px",marginBottom:6}}>✅ Import Successful</div>
          <div style={{fontSize:13,color:"var(--dust)"}}>Imported {importResult.count} listings as <strong>pending</strong> — review in the Pending tab.{importResult.skipped ? ` Skipped ${importResult.skipped} invalid rows.` : ""}</div>
          <button className="btn-outline" style={{marginTop:10}} onClick={()=>setImportResult(null)}>Close</button>
        </div>
      )}

      {/* Template download */}
      <div className="bulk-import-card">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12,marginBottom:14}}>
          <div>
            <div style={{fontFamily:"Oswald,sans-serif",fontSize:16,color:"var(--ivory)",letterSpacing:"1px",marginBottom:4}}>STEP 1 · DOWNLOAD TEMPLATE</div>
            <div style={{fontSize:12,color:"var(--sand)"}}>Download the CSV template, fill it in with your equipment, then upload below.</div>
          </div>
          <button className="btn-primary" onClick={downloadTemplate}>📥 Download CSV Template</button>
        </div>
        <div className="bulk-template">{csvTemplate}</div>
        <div style={{fontSize:11,color:"var(--bark)",marginTop:10,lineHeight:1.6}}>
          <strong style={{color:"var(--horizon)"}}>Required columns:</strong> name, category, region, location, price, contact<br/>
          <strong style={{color:"var(--horizon)"}}>Optional:</strong> unit (day/hour/week/month), condition, year, hours, email, description, listingType (hire/sale), tier (free/featured/premium), negotiable (true/false)<br/>
          <strong style={{color:"var(--horizon)"}}>Valid categories:</strong> {CATEGORIES.join(", ")}<br/>
          <strong style={{color:"var(--horizon)"}}>Valid regions:</strong> {REGIONS.slice(0,7).join(", ")} + 7 more
        </div>
      </div>

      {/* Upload */}
      <div className="bulk-import-card">
        <div style={{fontFamily:"Oswald,sans-serif",fontSize:16,color:"var(--ivory)",letterSpacing:"1px",marginBottom:10}}>STEP 2 · UPLOAD YOUR CSV</div>
        <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap",marginBottom:14}}>
          <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={e=>handleFile(e.target.files)}
            style={{padding:10,background:"var(--soil)",border:"1px solid var(--clay)",borderRadius:3,color:"var(--dust)",fontSize:12,flex:1,minWidth:200}} />
          <button className="btn-outline" onClick={()=>{ setCsvText(""); setPreview(null); if(fileRef.current) fileRef.current.value=""; }}>Clear</button>
        </div>
        <textarea rows={6} placeholder="Or paste CSV content here..." value={csvText}
          onChange={e=>{ setCsvText(e.target.value); if(e.target.value.trim()) parseCsv(e.target.value); else setPreview(null); }}
          style={{width:"100%",padding:10,background:"var(--soil)",border:"1px solid var(--clay)",borderRadius:3,color:"var(--dust)",fontSize:11,fontFamily:"monospace"}} />
      </div>

      {/* Preview */}
      {preview && (
        <div className="bulk-import-card">
          <div style={{fontFamily:"Oswald,sans-serif",fontSize:16,color:"var(--ivory)",letterSpacing:"1px",marginBottom:10}}>STEP 3 · PREVIEW & IMPORT</div>
          {preview.error ? (
            <div style={{background:"rgba(183,28,28,.1)",border:"1px solid #ef4444",borderRadius:3,padding:"10px 14px",color:"#ef9a9a",fontSize:12}}>❌ {preview.error}</div>
          ) : (
            <>
              <div style={{display:"flex",gap:20,marginBottom:10,fontSize:12,flexWrap:"wrap"}}>
                <span style={{color:"var(--sand)"}}>Total rows: <strong style={{color:"var(--dust)"}}>{preview.total}</strong></span>
                <span style={{color:"#81c784"}}>✓ Valid: <strong>{preview.valid}</strong></span>
                {preview.total - preview.valid > 0 && <span style={{color:"#ef9a9a"}}>✕ Invalid: <strong>{preview.total - preview.valid}</strong></span>}
              </div>
              <div style={{overflowX:"auto",maxHeight:320,border:"1px solid var(--clay)",borderRadius:3}}>
                <table className="bulk-preview-table">
                  <thead>
                    <tr><th>Row</th><th>Name</th><th>Type</th><th>Category</th><th>Region</th><th>Price</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {preview.rows.map(r => (
                      <tr key={r._row} className={r._valid?"valid":"invalid"}>
                        <td>{r._row}</td>
                        <td>{r.name||"—"}</td>
                        <td>{r.listingType||"hire"}</td>
                        <td>{r.category}</td>
                        <td>{r.region}</td>
                        <td>N${r.price ? parseInt(r.price).toLocaleString() : "—"}</td>
                        <td>{r._valid ? "✓ Valid" : r._errors.join(", ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.valid > 0 && (
                <button className="btn-primary" style={{marginTop:14,padding:"12px 24px",fontSize:13}} onClick={doImport}>
                  📥 Import {preview.valid} Listing{preview.valid!==1?"s":""} as Pending
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WANTED BOARD — Public page where buyers post requests for equipment
// Identity & contact details are HIDDEN from public. Only admin sees.
// ─────────────────────────────────────────────────────────────────────────────
function WantedBoardPage({ requests, onRequestSubmitted, listings }) {
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("all");
  const [category, setCategory] = useState("All");
  const [region, setRegion] = useState("All");

  const approved = requests.filter(r => r.status === "approved");
  const hireCount = approved.filter(r => r.requestType === "hire").length;
  const saleCount = approved.filter(r => r.requestType === "sale").length;
  const urgentCount = approved.filter(r => r.urgency === "urgent").length;

  const filtered = approved.filter(r => {
    if (filter === "hire" && r.requestType !== "hire") return false;
    if (filter === "sale" && r.requestType !== "sale") return false;
    if (filter === "urgent" && r.urgency !== "urgent") return false;
    if (category !== "All" && r.category !== category) return false;
    if (region !== "All" && r.region !== region) return false;
    return true;
  }).sort((a,b) => {
    // urgent first, then newest
    if (a.urgency === "urgent" && b.urgency !== "urgent") return -1;
    if (b.urgency === "urgent" && a.urgency !== "urgent") return 1;
    return b.submittedAt - a.submittedAt;
  });

  const fmtDate = ts => {
    const days = Math.floor((Date.now() - ts) / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days/7)}w ago`;
    return `${Math.floor(days/30)}mo ago`;
  };

  const urgencyLabel = { urgent: "🔥 Urgent", within_month: "📅 Within month", flexible: "⏳ Flexible" };

  return (
    <div style={{padding:"32px 20px",maxWidth:1200,margin:"0 auto"}}>
      <div className="wanted-hero">
        <h1>🔎 <span>WANTED</span> BOARD</h1>
        <p>Can't find what you need on the app? Post a <strong>FREE request</strong> here. BLC and equipment owners will contact you directly. Your name & phone stay 100% private — only BLC sees them.</p>
        <div className="wanted-cta-row">
          <button className="btn-primary" onClick={()=>setShowForm(true)} style={{background:"linear-gradient(135deg,#6db3e8 0%,#2d7fd4 100%)",color:"#fff",padding:"12px 28px",fontSize:14}}>➕ Post Your Request</button>
        </div>
      </div>

      {showForm && (
        <WantedRequestForm
          onSubmit={(req) => { onRequestSubmitted(req); setShowForm(false); }}
          onCancel={()=>setShowForm(false)}
        />
      )}

      <div className="wanted-stats">
        <div className="wanted-stat"><div className="wanted-stat-n">{approved.length}</div><div className="wanted-stat-l">Active Requests</div></div>
        <div className="wanted-stat"><div className="wanted-stat-n">{hireCount}</div><div className="wanted-stat-l">Looking to Hire</div></div>
        <div className="wanted-stat"><div className="wanted-stat-n">{saleCount}</div><div className="wanted-stat-l">Looking to Buy</div></div>
        <div className="wanted-stat"><div className="wanted-stat-n" style={{color:"#ff8c42"}}>{urgentCount}</div><div className="wanted-stat-l">Urgent</div></div>
      </div>

      {/* Filters */}
      <div style={{background:"var(--earth)",border:"1px solid var(--clay)",borderRadius:4,padding:16,marginBottom:20,display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          <button className={`admin-tab${filter==="all"?" active":""}`} onClick={()=>setFilter("all")}>All</button>
          <button className={`admin-tab${filter==="hire"?" active":""}`} onClick={()=>setFilter("hire")}>🔑 Hire</button>
          <button className={`admin-tab${filter==="sale"?" active":""}`} onClick={()=>setFilter("sale")}>🏷 Buy</button>
          <button className={`admin-tab${filter==="urgent"?" active":""}`} onClick={()=>setFilter("urgent")}>🔥 Urgent</button>
        </div>
        <select value={category} onChange={e=>setCategory(e.target.value)} style={{padding:8,background:"var(--soil)",border:"1px solid var(--clay)",borderRadius:3,color:"var(--dust)",fontSize:12}}>
          <option>All</option>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <select value={region} onChange={e=>setRegion(e.target.value)} style={{padding:8,background:"var(--soil)",border:"1px solid var(--clay)",borderRadius:3,color:"var(--dust)",fontSize:12}}>
          <option>All</option>
          {REGIONS.map(r => <option key={r}>{r}</option>)}
        </select>
        <div style={{marginLeft:"auto",fontSize:12,color:"var(--sand)"}}>{filtered.length} request{filtered.length!==1?"s":""}</div>
      </div>

      {/* Requests grid */}
      {filtered.length === 0 ? (
        <div className="empty"><div className="empty-icon">🔎</div><h3>No requests match your filter</h3><p>Try changing filters, or post your own request.</p></div>
      ) : (
        <div className="wanted-grid">
          {filtered.map(r => {
            const matchCount = listings.filter(l => l.status==="approved" && l.listingType===r.requestType && l.category===r.category && l.region===r.region).length;
            return (
              <div key={r.id} className={`wanted-card${r.urgency==="urgent"?" urgent":""}`}>
                <div className="wanted-head">
                  <div>
                    <span className={`wanted-type-pill ${r.requestType==="hire"?"wt-hire":"wt-sale"}`}>
                      {r.requestType==="hire"?"🔑 Looking to Hire":"🏷 Looking to Buy"}
                    </span>
                  </div>
                  <div className="wanted-ref">Ref: {genRequestRef(r.id)}</div>
                </div>
                <div className="wanted-cat">{CAT_ICONS[r.category]||"⚙️"} {r.category}</div>
                <div className="wanted-region">📍 {r.region}</div>
                <div className="wanted-desc">{r.description}</div>
                {(r.budgetMin || r.budgetMax) && (
                  <div className="wanted-budget">
                    <div className="wanted-budget-label">Budget Range</div>
                    <div className="wanted-budget-amt">
                      {r.budgetMin && r.budgetMax ? `N$${r.budgetMin.toLocaleString()} - N$${r.budgetMax.toLocaleString()}` :
                       r.budgetMin ? `From N$${r.budgetMin.toLocaleString()}` :
                       `Up to N$${r.budgetMax.toLocaleString()}`}
                      {r.requestType==="hire" && r.unit && <span style={{fontSize:11,color:"var(--sand)",fontWeight:400,marginLeft:4}}>/ {r.unit}</span>}
                    </div>
                  </div>
                )}
                <div className="wanted-meta">
                  <span className={`wanted-urgency wu-${r.urgency}`}>{urgencyLabel[r.urgency] || r.urgency}</span>
                  <span>{fmtDate(r.submittedAt)}</span>
                </div>
                <div className="wanted-contact-hidden">
                  🔒 <strong>Identity hidden</strong> · If you can supply this, <a href={`tel:+264816034139`} style={{color:"#6db3e8"}}>📞 call BLC</a> or <a href={`mailto:blc.bertus@gmail.com?subject=Wanted%20Request%20${genRequestRef(r.id)}&body=Hi%20BLC,%0D%0A%0D%0AI%20can%20supply%20the%20equipment%20requested%20in%20${genRequestRef(r.id)}.%0D%0A%0D%0ADetails:`} style={{color:"#6db3e8"}}>✉ email</a>
                  {matchCount > 0 && <div style={{marginTop:6,color:"var(--teal-light)"}}>💡 {matchCount} similar listing{matchCount!==1?"s":""} already on platform</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WANTED REQUEST FORM
// ─────────────────────────────────────────────────────────────────────────────
function WantedRequestForm({ onSubmit, onCancel }) {
  const [form, setForm] = useState({
    category: CATEGORIES[0], region: REGIONS[0], requestType: "hire", urgency: "flexible",
    description: "", budgetMin: "", budgetMax: "", unit: "day",
    buyerName: "", buyerPhone: "", buyerEmail: "",
  });
  const [err, setErr] = useState("");
  const sf = (k,v) => setForm(f => ({...f, [k]:v}));

  const submit = () => {
    setErr("");
    if (!form.description.trim() || form.description.trim().length < 20) {
      setErr("Please describe what you need (minimum 20 characters)"); return;
    }
    if (!form.buyerName.trim() || !form.buyerPhone.trim()) {
      setErr("Your name and phone are required (kept private — only BLC sees them)"); return;
    }
    const request = {
      id: `req_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
      ...form,
      description: form.description.trim(),
      buyerName: form.buyerName.trim(),
      buyerPhone: form.buyerPhone.trim(),
      buyerEmail: form.buyerEmail.trim(),
      budgetMin: form.budgetMin ? parseInt(form.budgetMin) : null,
      budgetMax: form.budgetMax ? parseInt(form.budgetMax) : null,
      status: "pending", // admin must approve before going public
      submittedAt: Date.now(),
    };
    onSubmit(request);
  };

  return (
    <div className="wanted-form-modal" style={{marginBottom:28}}>
      <div style={{fontFamily:"Oswald,sans-serif",fontSize:22,letterSpacing:"1.5px",color:"var(--ivory)",marginBottom:8}}>📝 POST YOUR EQUIPMENT REQUEST</div>
      <div style={{fontSize:12,color:"var(--sand)",marginBottom:20,lineHeight:1.6}}>
        Tell the market what you're looking for. Your <strong style={{color:"#6db3e8"}}>name, phone &amp; email stay private</strong> — only BLC sees them. Equipment owners will contact you through BLC. Requests are reviewed within 24 hours before going live.
      </div>

      <div className="if-row" style={{marginBottom:12}}>
        <div className="fg"><label>Request Type *</label>
          <select value={form.requestType} onChange={e=>sf("requestType",e.target.value)}>
            <option value="hire">🔑 Looking to Hire</option>
            <option value="sale">🏷 Looking to Buy</option>
          </select>
        </div>
        <div className="fg"><label>Urgency *</label>
          <select value={form.urgency} onChange={e=>sf("urgency",e.target.value)}>
            <option value="urgent">🔥 Urgent (this week)</option>
            <option value="within_month">📅 Within a month</option>
            <option value="flexible">⏳ Flexible timing</option>
          </select>
        </div>
      </div>

      <div className="if-row" style={{marginBottom:12}}>
        <div className="fg"><label>Equipment Category *</label>
          <select value={form.category} onChange={e=>sf("category",e.target.value)}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="fg"><label>Region *</label>
          <select value={form.region} onChange={e=>sf("region",e.target.value)}>
            {REGIONS.map(r => <option key={r}>{r}</option>)}
          </select>
        </div>
      </div>

      <div className="fg" style={{marginBottom:12}}>
        <label>Describe What You Need *</label>
        <textarea rows={4} value={form.description} onChange={e=>sf("description",e.target.value)}
          placeholder="e.g., Need a 20-30 ton excavator in good condition for a 2-month road project. Must come with recent service records. Based in Windhoek." />
        <div style={{fontSize:11,color:"var(--bark)",marginTop:4}}>{form.description.length}/500 characters · minimum 20</div>
      </div>

      <div className="if-row" style={{marginBottom:12}}>
        <div className="fg"><label>Budget Min (N$) - optional</label>
          <input type="number" value={form.budgetMin} onChange={e=>sf("budgetMin",e.target.value)} placeholder="e.g., 3500" />
        </div>
        <div className="fg"><label>Budget Max (N$) - optional</label>
          <input type="number" value={form.budgetMax} onChange={e=>sf("budgetMax",e.target.value)} placeholder="e.g., 5500" />
        </div>
        {form.requestType === "hire" && (
          <div className="fg"><label>Per</label>
            <select value={form.unit} onChange={e=>sf("unit",e.target.value)}>
              <option value="hour">Hour</option><option value="day">Day</option>
              <option value="week">Week</option><option value="month">Month</option>
            </select>
          </div>
        )}
      </div>

      <div style={{background:"rgba(109,179,232,.08)",border:"1px solid #6db3e8",borderRadius:4,padding:"14px 18px",marginTop:20,marginBottom:14}}>
        <div style={{fontFamily:"Oswald,sans-serif",fontSize:14,color:"#6db3e8",letterSpacing:"1.5px",marginBottom:8}}>🔒 PRIVATE CONTACT INFO</div>
        <div style={{fontSize:12,color:"var(--sand)",lineHeight:1.6,marginBottom:14}}>
          These details are <strong>NEVER shown publicly</strong>. Only BLC staff see this info so they can connect you with equipment owners.
        </div>
        <div className="if-row" style={{marginBottom:10}}>
          <div className="fg"><label>Your Name *</label>
            <input value={form.buyerName} onChange={e=>sf("buyerName",e.target.value)} placeholder="Full name" />
          </div>
          <div className="fg"><label>Phone *</label>
            <input value={form.buyerPhone} onChange={e=>sf("buyerPhone",e.target.value)} placeholder="+264 ..." />
          </div>
        </div>
        <div className="fg" style={{marginBottom:0}}>
          <label>Email (optional)</label>
          <input value={form.buyerEmail} onChange={e=>sf("buyerEmail",e.target.value)} placeholder="your@email.com" />
        </div>
      </div>

      {err && <div style={{background:"rgba(183,28,28,.15)",color:"#ef9a9a",padding:"10px 14px",borderRadius:3,fontSize:12,marginBottom:12}}>⚠ {err}</div>}

      <div style={{display:"flex",gap:10}}>
        <button className="btn-primary" onClick={submit} style={{flex:1,justifyContent:"center",background:"linear-gradient(135deg,#6db3e8 0%,#2d7fd4 100%)",color:"#fff"}}>📤 Submit Request (FREE)</button>
        <button className="btn-outline" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN WANTED PANEL — Full contact details visible only to admin
// ─────────────────────────────────────────────────────────────────────────────
function AdminWantedPanel({ requests, setRequests, listings }) {
  const [filter, setFilter] = useState("pending");
  const pending = requests.filter(r => r.status === "pending");
  const approved = requests.filter(r => r.status === "approved");
  const rejected = requests.filter(r => r.status === "rejected" || r.status === "fulfilled");
  const display = filter === "pending" ? pending : filter === "approved" ? approved : rejected;

  const approve = (id) => {
    const u = requests.map(r => r.id===id ? {...r, status:"approved", approvedAt:Date.now()} : r);
    setRequests(u); saveRequests(u);
  };
  const reject = (id) => {
    if (!window.confirm("Reject this request? Buyer will not be notified.")) return;
    const u = requests.map(r => r.id===id ? {...r, status:"rejected", rejectedAt:Date.now()} : r);
    setRequests(u); saveRequests(u);
  };
  const markFulfilled = (id) => {
    if (!window.confirm("Mark as fulfilled? It will be removed from the public board.")) return;
    const u = requests.map(r => r.id===id ? {...r, status:"fulfilled", fulfilledAt:Date.now()} : r);
    setRequests(u); saveRequests(u);
  };
  const del = (id) => {
    if (!window.confirm("Delete this request permanently?")) return;
    const u = requests.filter(r => r.id!==id);
    setRequests(u); saveRequests(u);
  };

  const fmtDate = ts => new Date(ts).toLocaleString("en-NA",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});

  return (
    <div>
      <div style={{marginBottom:20}}>
        <div style={{fontFamily:"Oswald,sans-serif",fontSize:22,letterSpacing:"1.5px",color:"var(--ivory)"}}>🔎 WANTED BOARD REQUESTS</div>
        <div style={{fontSize:12,color:"var(--sand)",marginTop:4}}>Buyer requests for equipment. <strong style={{color:"#6db3e8"}}>Contact details are visible to admin only.</strong></div>
      </div>

      <div className="revenue-summary" style={{marginBottom:20}}>
        <div className="rev-item"><div className="rev-num" style={{color:"#ff8c42"}}>{pending.length}</div><div className="rev-label">Pending Review</div></div>
        <div className="rev-item"><div className="rev-num green">{approved.length}</div><div className="rev-label">Live on Board</div></div>
        <div className="rev-item"><div className="rev-num" style={{color:"var(--teal-light)"}}>{requests.filter(r=>r.urgency==="urgent" && r.status==="approved").length}</div><div className="rev-label">Urgent Live</div></div>
        <div className="rev-item"><div className="rev-num">{requests.filter(r=>r.status==="fulfilled").length}</div><div className="rev-label">Fulfilled</div></div>
      </div>

      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
        <button className={`admin-tab${filter==="pending"?" active":""}`} onClick={()=>setFilter("pending")}>⏳ Pending {pending.length>0 && <span className="bc" style={{background:"#ef4444",color:"#fff"}}>{pending.length}</span>}</button>
        <button className={`admin-tab${filter==="approved"?" active":""}`} onClick={()=>setFilter("approved")}>✅ Live ({approved.length})</button>
        <button className={`admin-tab${filter==="rejected"?" active":""}`} onClick={()=>setFilter("rejected")}>✕ Closed ({rejected.length})</button>
      </div>

      {display.length === 0 ? (
        <div className="empty"><div className="empty-icon">🔎</div><h3>No {filter} requests</h3><p>Buyer equipment requests will appear here for review.</p></div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {display.slice().sort((a,b)=>b.submittedAt-a.submittedAt).map(r => {
            const matches = listings.filter(l => l.status==="approved" && l.listingType===r.requestType && l.category===r.category);
            return (
              <div key={r.id} style={{background:"var(--earth)",border:`1px solid ${r.status==="pending"?"#ff8c42":"var(--clay)"}`,borderRadius:6,padding:18}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12,marginBottom:12}}>
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:6}}>
                      <span className={`wanted-type-pill ${r.requestType==="hire"?"wt-hire":"wt-sale"}`}>
                        {r.requestType==="hire"?"🔑 Hire":"🏷 Buy"}
                      </span>
                      <span className={`wanted-urgency wu-${r.urgency}`}>{r.urgency.replace("_"," ")}</span>
                      <span style={{fontSize:11,color:"var(--bark)",fontFamily:"monospace"}}>{genRequestRef(r.id)}</span>
                    </div>
                    <div style={{fontFamily:"Oswald,sans-serif",fontSize:18,color:"var(--ivory)",letterSpacing:"1px"}}>{r.category} · {r.region}</div>
                  </div>
                  <div style={{fontSize:11,color:"var(--bark)",textAlign:"right"}}>{fmtDate(r.submittedAt)}</div>
                </div>

                <div style={{background:"var(--soil)",border:"1px solid var(--clay)",borderRadius:3,padding:"12px 14px",marginBottom:12,fontSize:13,color:"var(--dust)",lineHeight:1.6}}>
                  {r.description}
                </div>

                {(r.budgetMin || r.budgetMax) && (
                  <div style={{marginBottom:12,fontSize:13,color:"var(--sand)"}}>
                    <strong style={{color:"#6db3e8"}}>Budget:</strong>{" "}
                    {r.budgetMin && r.budgetMax ? `N$${r.budgetMin.toLocaleString()} - N$${r.budgetMax.toLocaleString()}` :
                     r.budgetMin ? `From N$${r.budgetMin.toLocaleString()}` :
                     `Up to N$${r.budgetMax.toLocaleString()}`}
                    {r.requestType==="hire" && r.unit && ` / ${r.unit}`}
                  </div>
                )}

                {/* CONTACT DETAILS - ADMIN ONLY */}
                <div style={{background:"rgba(109,179,232,.08)",border:"1px solid #6db3e8",borderRadius:3,padding:"12px 14px",marginBottom:12}}>
                  <div style={{fontSize:10,color:"#6db3e8",letterSpacing:"1.5px",textTransform:"uppercase",marginBottom:8,fontWeight:700}}>🔒 Buyer Contact (Admin Only)</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10,fontSize:12}}>
                    <div><span style={{color:"var(--sand)",fontSize:10}}>Name:</span><br/><strong style={{color:"var(--ivory)"}}>{r.buyerName}</strong></div>
                    <div><span style={{color:"var(--sand)",fontSize:10}}>Phone:</span><br/><a href={`tel:${r.buyerPhone}`} style={{color:"var(--horizon)"}}>{r.buyerPhone}</a></div>
                    {r.buyerEmail && <div><span style={{color:"var(--sand)",fontSize:10}}>Email:</span><br/><a href={`mailto:${r.buyerEmail}`} style={{color:"var(--horizon)",fontSize:11}}>{r.buyerEmail}</a></div>}
                  </div>
                </div>

                {matches.length > 0 && (
                  <div style={{background:"rgba(34,160,144,.08)",border:"1px solid var(--teal-light)",borderRadius:3,padding:"10px 14px",marginBottom:12,fontSize:12,color:"var(--dust)"}}>
                    💡 <strong style={{color:"var(--teal-light)"}}>{matches.length} matching listing{matches.length!==1?"s":""}</strong> on the platform — you could connect this buyer directly to existing owners.
                  </div>
                )}

                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {r.status === "pending" && (
                    <>
                      <button className="btn-primary" onClick={()=>approve(r.id)} style={{background:"linear-gradient(135deg,#2ba84a,#187530)",color:"#fff"}}>✓ Approve &amp; Publish</button>
                      <button className="btn-outline" onClick={()=>reject(r.id)} style={{color:"#ef9a9a",borderColor:"#ef4444"}}>✕ Reject</button>
                    </>
                  )}
                  {r.status === "approved" && (
                    <>
                      <button className="btn-primary" onClick={()=>markFulfilled(r.id)} style={{background:"var(--teal-light)",color:"var(--soil)"}}>✓ Mark Fulfilled</button>
                      <a href={`tel:${r.buyerPhone}`} className="btn-muted" style={{textDecoration:"none"}}>📞 Call Buyer</a>
                      <a href={`https://wa.me/${r.buyerPhone.replace(/\D/g,"")}?text=Hi%20${encodeURIComponent(r.buyerName.split(" ")[0])},%20regarding%20your%20request%20${genRequestRef(r.id)}%20for%20${encodeURIComponent(r.category)}...`} target="_blank" rel="noreferrer" className="btn-muted" style={{textDecoration:"none",background:"#25d366",color:"#fff"}}>💬 WhatsApp</a>
                    </>
                  )}
                  <button className="btn-muted" onClick={()=>del(r.id)} style={{marginLeft:"auto"}}>🗑 Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BID FORM — Shown on sale listing modal, lets buyers place bids
// ─────────────────────────────────────────────────────────────────────────────
function BidForm({ listing, bids, onBidPlaced }) {
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [err, setErr] = useState("");

  const listingBids = bids.filter(b => b.listingId===listing.id && b.status!=="rejected" && b.status!=="withdrawn");
  const highest = highestBidForListing(bids, listing.id);
  const listingPrice = parseInt(listing.price) || 0;
  const minBid = highest ? highest.amount + 1000 : Math.floor(listingPrice * 0.7);
  const hasAccepted = bids.some(b => b.listingId===listing.id && b.status==="accepted");

  const submit = () => {
    setErr("");
    const amt = parseInt(amount);
    if (!amt || amt < minBid) { setErr(`Minimum bid: N$${minBid.toLocaleString()}`); return; }
    if (!name.trim() || !phone.trim()) { setErr("Name and phone are required"); return; }
    
    const newBid = {
      id: `bid_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
      listingId: listing.id,
      listingName: listing.name,
      amount: amt,
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      message: message.trim(),
      status: "pending",
      submittedAt: Date.now(),
    };
    
    // If this bid outbids a previous one, send SMS to outbid buyer
    if (highest && amt > highest.amount && highest.phone) {
      queueSms(highest.phone, SMS_TEMPLATES.bid_outbid(highest, listing, amt), "bid_outbid");
    }
    // Notify admin via SMS
    queueSms("+264816034139", SMS_TEMPLATES.bid_received(newBid, listing), "bid_received");
    
    onBidPlaced(newBid);
    trackEvent("bid_placed", { listingId: listing.id, amount: amt });
    setAmount(""); setName(""); setPhone(""); setEmail(""); setMessage("");
    setShowForm(false);
  };

  if (hasAccepted) {
    return (
      <div className="bid-panel" style={{borderColor:"var(--green-ok)",background:"rgba(46,125,50,.08)"}}>
        <div style={{textAlign:"center"}}>
          <div style={{fontFamily:"Oswald,sans-serif",fontSize:18,color:"#81c784",letterSpacing:"2px",marginBottom:6}}>✅ BID ACCEPTED</div>
          <div style={{fontSize:12,color:"var(--sand)"}}>A bid has been accepted on this item. Bidding is now closed.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bid-panel">
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:10}}>
        <div style={{fontFamily:"Oswald,sans-serif",fontSize:18,color:"#ff8c42",letterSpacing:"2px"}}>🔨 PLACE A BID</div>
        <span className="bid-count-pill">{listingBids.length} bid{listingBids.length!==1?"s":""}</span>
      </div>
      
      {highest ? (
        <div className="bid-highest">
          <div>
            <div className="bid-highest-label">Current Highest Bid</div>
            <div className="bid-highest-amount">N${highest.amount.toLocaleString()}</div>
          </div>
          <div style={{textAlign:"right",fontSize:11,color:"var(--sand)"}}>
            by {highest.name.split(" ")[0]}<br/>
            <span style={{opacity:.7}}>{new Date(highest.submittedAt).toLocaleDateString("en-NA",{day:"numeric",month:"short"})}</span>
          </div>
        </div>
      ) : (
        <div className="bid-highest">
          <div>
            <div className="bid-highest-label">Asking Price</div>
            <div className="bid-highest-amount">N${listingPrice.toLocaleString()}</div>
          </div>
          <div style={{textAlign:"right",fontSize:11,color:"var(--sand)"}}>No bids yet<br/><span style={{opacity:.7}}>Be the first!</span></div>
        </div>
      )}

      {!showForm ? (
        <button className="bid-btn" onClick={()=>setShowForm(true)} style={{width:"100%",justifyContent:"center"}}>
          💰 Place Your Bid
        </button>
      ) : (
        <div className="bid-form">
          <div>
            <label style={{fontSize:11,color:"var(--sand)",letterSpacing:"1px",textTransform:"uppercase",marginBottom:4,display:"block"}}>Your Bid Amount</label>
            <div className="bid-input-group">
              <div className="bid-currency">N$</div>
              <input type="number" className="bid-input" value={amount} onChange={e=>setAmount(e.target.value)} placeholder={minBid.toLocaleString()} min={minBid} />
            </div>
            <div className="bid-min-note">Minimum bid: N${minBid.toLocaleString()} {listing.negotiable && <span style={{color:"var(--teal-light)"}}>· Seller accepts negotiation</span>}</div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div className="fg" style={{marginBottom:0}}>
              <label>Your Name *</label>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="Full name" />
            </div>
            <div className="fg" style={{marginBottom:0}}>
              <label>Phone *</label>
              <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+264 ..." />
            </div>
          </div>

          <div className="fg" style={{marginBottom:0}}>
            <label>Email (optional)</label>
            <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com" />
          </div>

          <div className="fg" style={{marginBottom:0}}>
            <label>Message to Seller (optional)</label>
            <textarea rows={2} value={message} onChange={e=>setMessage(e.target.value)} placeholder="e.g., Cash buyer, can collect immediately..." />
          </div>

          {err && <div style={{background:"rgba(183,28,28,.15)",color:"#ef9a9a",padding:"8px 12px",borderRadius:3,fontSize:12}}>⚠ {err}</div>}
          
          <div style={{background:"rgba(232,146,12,.08)",border:"1px solid var(--dune)",borderRadius:3,padding:"10px 14px",fontSize:11,color:"var(--sand)",lineHeight:1.6}}>
            💡 <strong style={{color:"var(--horizon)"}}>How bidding works:</strong> Your bid is submitted to BLC for review. If accepted, BLC will contact you within 24 hours to finalize payment and collection. You can withdraw your bid before acceptance.
          </div>

          <div style={{display:"flex",gap:10}}>
            <button className="bid-btn" onClick={submit} style={{flex:1,justifyContent:"center"}}>✓ Submit Bid</button>
            <button className="btn-outline" onClick={()=>{setShowForm(false);setErr("");}}>Cancel</button>
          </div>
        </div>
      )}

      {/* Show recent bids (anonymized) */}
      {listingBids.length > 0 && (
        <div style={{marginTop:16,borderTop:"1px solid var(--clay)",paddingTop:12}}>
          <div style={{fontSize:11,color:"var(--sand)",letterSpacing:"1.5px",textTransform:"uppercase",marginBottom:8}}>Recent Bids</div>
          <div className="bid-history">
            {listingBids.slice().sort((a,b)=>b.amount-a.amount).slice(0,5).map((b,i) => {
              const initials = b.name.split(" ").map(n=>n[0]).slice(0,2).join("").toUpperCase();
              const isWinning = b.id === highest?.id;
              return (
                <div key={b.id} className={`bid-row${isWinning?" winning":""}`}>
                  <div>
                    <strong style={{color:"var(--ivory)"}}>{initials}***</strong>
                    <span style={{marginLeft:8,color:"var(--bark)",fontSize:10}}>{new Date(b.submittedAt).toLocaleDateString("en-NA",{day:"numeric",month:"short"})}</span>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontFamily:"Oswald,sans-serif",fontSize:14,fontWeight:700,color:isWinning?"#ff8c42":"var(--dust)"}}>N${b.amount.toLocaleString()}</span>
                    {isWinning && <span className="bid-status-pill bs-winning">Leading</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN BIDS PANEL — View, accept, reject bids
// ─────────────────────────────────────────────────────────────────────────────
function AdminBidsPanel({ bids, setBids, listings }) {
  const [filter, setFilter] = useState("pending");
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  const pending = bids.filter(b => b.status==="pending");
  const accepted = bids.filter(b => b.status==="accepted");
  const rejected = bids.filter(b => b.status==="rejected" || b.status==="withdrawn");

  const display = filter==="pending" ? pending : filter==="accepted" ? accepted : rejected;

  const acceptBid = (id) => {
    const bid = bids.find(b => b.id===id);
    if (!bid) return;
    const listing = listings.find(l => l.id===bid.listingId);
    if (!window.confirm(`Accept bid of N$${bid.amount.toLocaleString()} from ${bid.name}?\n\nThis will:\n• Mark item as sold\n• Reject all other bids on this item\n• Send SMS to buyer`)) return;
    
    // Accept this bid, auto-reject all others on same listing
    const u = bids.map(b => {
      if (b.id===id) return {...b, status:"accepted", acceptedAt:Date.now()};
      if (b.listingId===bid.listingId && b.status==="pending") return {...b, status:"rejected", rejectedAt:Date.now(), rejectionReason:"Another bid was accepted"};
      return b;
    });
    setBids(u); saveBids(u);
    
    // SMS to winner
    if (bid.phone) queueSms(bid.phone, SMS_TEMPLATES.bid_accepted(bid, listing), "bid_accepted");
    // SMS to losers
    u.filter(b => b.listingId===bid.listingId && b.status==="rejected" && b.id!==id).forEach(b => {
      if (b.phone) queueSms(b.phone, SMS_TEMPLATES.bid_rejected(b, listing, "Another buyer's bid was accepted"), "bid_rejected");
    });
  };

  const rejectBid = (id) => {
    const bid = bids.find(b => b.id===id);
    const listing = listings.find(l => l.id===bid.listingId);
    const u = bids.map(b => b.id===id ? {...b, status:"rejected", rejectedAt:Date.now(), rejectionReason:rejectReason} : b);
    setBids(u); saveBids(u);
    if (bid.phone) queueSms(bid.phone, SMS_TEMPLATES.bid_rejected(bid, listing, rejectReason), "bid_rejected");
    setRejectingId(null); setRejectReason("");
  };

  const deleteBid = (id) => {
    if (!window.confirm("Delete this bid permanently?")) return;
    const u = bids.filter(b => b.id!==id);
    setBids(u); saveBids(u);
  };

  const fmtDate = ts => new Date(ts).toLocaleString("en-NA",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});

  return (
    <div>
      <div style={{marginBottom:20}}>
        <div style={{fontFamily:"Oswald,sans-serif",fontSize:22,letterSpacing:"1.5px",color:"var(--ivory)"}}>🔨 BIDS & OFFERS</div>
        <div style={{fontSize:12,color:"var(--sand)",marginTop:4}}>Review and manage bids from buyers on sale listings.</div>
      </div>

      <div className="revenue-summary" style={{marginBottom:20}}>
        <div className="rev-item"><div className="rev-num" style={{color:"#ff8c42"}}>{pending.length}</div><div className="rev-label">Pending Review</div></div>
        <div className="rev-item"><div className="rev-num green">{accepted.length}</div><div className="rev-label">Accepted</div></div>
        <div className="rev-item"><div className="rev-num">{rejected.length}</div><div className="rev-label">Closed/Rejected</div></div>
        <div className="rev-item"><div className="rev-num" style={{color:"var(--teal-light)"}}>N${bids.filter(b=>b.status==="accepted").reduce((s,b)=>s+b.amount,0).toLocaleString()}</div><div className="rev-label">Total Sales</div></div>
      </div>

      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
        <button className={`admin-tab${filter==="pending"?" active":""}`} onClick={()=>setFilter("pending")}>⏳ Pending {pending.length>0 && <span className="bc" style={{background:"#ef4444",color:"#fff"}}>{pending.length}</span>}</button>
        <button className={`admin-tab${filter==="accepted"?" active":""}`} onClick={()=>setFilter("accepted")}>✅ Accepted</button>
        <button className={`admin-tab${filter==="rejected"?" active":""}`} onClick={()=>setFilter("rejected")}>✕ Rejected/Closed</button>
      </div>

      {display.length === 0 ? (
        <div className="empty"><div className="empty-icon">🔨</div><h3>No {filter} bids</h3><p>Bids from buyers on sale listings will appear here.</p></div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {display.slice().sort((a,b)=>b.submittedAt-a.submittedAt).map(bid => {
            const listing = listings.find(l => l.id===bid.listingId);
            const listingBids = bids.filter(b => b.listingId===bid.listingId && b.status!=="rejected" && b.status!=="withdrawn");
            const isHighest = highestBidForListing(bids, bid.listingId)?.id === bid.id;
            return (
              <div key={bid.id} style={{background:"var(--earth)",border:`1px solid ${bid.status==="pending"?"#ff8c42":"var(--clay)"}`,borderRadius:6,padding:18}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12,marginBottom:12}}>
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6,flexWrap:"wrap"}}>
                      <span style={{fontFamily:"Oswald,sans-serif",fontSize:24,fontWeight:900,color:"#ff8c42"}}>N${bid.amount.toLocaleString()}</span>
                      {isHighest && bid.status==="pending" && <span className="bid-status-pill bs-winning">👑 Highest</span>}
                      <span className={`bid-status-pill bs-${bid.status}`}>{bid.status}</span>
                    </div>
                    <div style={{fontSize:13,color:"var(--ivory)",fontWeight:700}}>{listing?.name || bid.listingName} <span style={{color:"var(--bark)",fontSize:10,fontWeight:400,marginLeft:6}}>Ref: {genBidRef(bid.id)}</span></div>
                    <div style={{fontSize:11,color:"var(--sand)",marginTop:2}}>Asking: N${parseInt(listing?.price||0).toLocaleString()} · {listingBids.length} total bid{listingBids.length!==1?"s":""}</div>
                  </div>
                  <div style={{fontSize:11,color:"var(--bark)",textAlign:"right"}}>{fmtDate(bid.submittedAt)}</div>
                </div>

                <div style={{background:"var(--soil)",borderRadius:3,padding:"10px 14px",marginBottom:12}}>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10,fontSize:12}}>
                    <div><span style={{color:"var(--sand)",fontSize:10,textTransform:"uppercase",letterSpacing:"1px"}}>Buyer</span><br/><strong style={{color:"var(--ivory)"}}>{bid.name}</strong></div>
                    <div><span style={{color:"var(--sand)",fontSize:10,textTransform:"uppercase",letterSpacing:"1px"}}>Phone</span><br/><a href={`tel:${bid.phone}`} style={{color:"var(--horizon)"}}>{bid.phone}</a></div>
                    {bid.email && <div><span style={{color:"var(--sand)",fontSize:10,textTransform:"uppercase",letterSpacing:"1px"}}>Email</span><br/><a href={`mailto:${bid.email}`} style={{color:"var(--horizon)",fontSize:11}}>{bid.email}</a></div>}
                  </div>
                  {bid.message && <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid var(--clay)",fontSize:12,color:"var(--dust)",fontStyle:"italic"}}>"💬 {bid.message}"</div>}
                </div>

                {bid.rejectionReason && (
                  <div style={{background:"rgba(183,28,28,.1)",border:"1px solid #ef4444",borderRadius:3,padding:"8px 12px",marginBottom:12,fontSize:12,color:"#ef9a9a"}}>
                    <strong>Rejection reason:</strong> {bid.rejectionReason}
                  </div>
                )}

                {bid.status === "pending" && (
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    <button className="btn-primary" onClick={()=>acceptBid(bid.id)} style={{background:"linear-gradient(135deg,#2ba84a,#187530)",color:"#fff"}}>✓ Accept Bid</button>
                    <button className="btn-outline" onClick={()=>setRejectingId(bid.id)} style={{color:"#ef9a9a",borderColor:"#ef4444"}}>✕ Reject</button>
                    <a href={`tel:${bid.phone}`} className="btn-muted" style={{textDecoration:"none",display:"inline-flex",alignItems:"center",gap:6}}>📞 Call</a>
                    <a href={`https://wa.me/${bid.phone.replace(/\D/g,"")}?text=Hi%20${encodeURIComponent(bid.name)},%20regarding%20your%20bid%20of%20N$${bid.amount.toLocaleString()}%20on%20${encodeURIComponent(listing?.name||"")}...`} target="_blank" rel="noreferrer" className="btn-muted" style={{textDecoration:"none",display:"inline-flex",alignItems:"center",gap:6,background:"#25d366",color:"#fff"}}>💬 WhatsApp</a>
                  </div>
                )}
                {(bid.status==="rejected" || bid.status==="withdrawn") && (
                  <button className="btn-muted" onClick={()=>deleteBid(bid.id)} style={{fontSize:11}}>🗑 Delete</button>
                )}

                {rejectingId === bid.id && (
                  <div style={{marginTop:12,padding:14,background:"rgba(183,28,28,.1)",border:"1px solid #ef4444",borderRadius:4}}>
                    <div className="fg" style={{marginBottom:10}}>
                      <label style={{color:"#ef9a9a"}}>Reason for rejection (optional, will be sent to buyer via SMS)</label>
                      <textarea rows={2} value={rejectReason} onChange={e=>setRejectReason(e.target.value)} placeholder="e.g., Bid too low, item no longer available..." />
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      <button className="btn-primary" onClick={()=>rejectBid(bid.id)} style={{background:"#ef4444"}}>Confirm Rejection</button>
                      <button className="btn-outline" onClick={()=>{setRejectingId(null);setRejectReason("");}}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WANTED / EQUIPMENT REQUEST PAGE — Public board for buyers to request equipment
// Contact details HIDDEN from public; only admin can see them
// ─────────────────────────────────────────────────────────────────────────────
function WantedPage({ wanted, setWanted, onSubmitted }) {
  const [view, setView] = useState("browse"); // browse | post
  const [form, setForm] = useState({
    category:"", region:"", location:"", title:"", description:"", 
    budget:"", purpose:"buy", urgency:"within_month",
    name:"", phone:"", email:""
  });
  const [err, setErr] = useState("");
  const [detailReq, setDetailReq] = useState(null);
  const [filterPurpose, setFilterPurpose] = useState("all");
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterRegion, setFilterRegion] = useState("All");
  const [search, setSearch] = useState("");

  const sf = (k,v) => setForm(f => ({...f, [k]:v}));

  const approved = wanted.filter(w => w.status === "approved");
  const filtered = approved.filter(w => {
    if (filterPurpose !== "all" && w.purpose !== filterPurpose && w.purpose !== "either") return false;
    if (filterCategory !== "All" && w.category !== filterCategory) return false;
    if (filterRegion !== "All" && w.region !== filterRegion) return false;
    if (search && !(w.title+w.description+w.category).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort((a,b) => b.submittedAt - a.submittedAt);

  const submit = () => {
    setErr("");
    if (!form.category || !form.region || !form.title || !form.description || !form.name || !form.phone) {
      setErr("Please fill in all required fields (marked with *)");
      return;
    }
    if (form.description.length < 30) {
      setErr("Please provide more detail in the description (at least 30 characters)");
      return;
    }

    const newReq = {
      id: `w_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
      ...form,
      status: "pending", // admin approves before public visibility
      submittedAt: Date.now(),
      views: 0,
    };
    const updated = [...wanted, newReq];
    setWanted(updated); saveWanted(updated);
    
    // Notify admin via SMS
    queueSms("+264816034139", `BLC Plant Hire: New WANTED request: ${form.title} (${form.category}, ${form.region}). Review in admin. Ref: ${genWantedRef(newReq.id)}`, "wanted_submitted");
    
    trackEvent("wanted_submitted", { category: form.category, region: form.region });
    onSubmitted();
    setForm({ category:"", region:"", location:"", title:"", description:"", budget:"", purpose:"buy", urgency:"within_month", name:"", phone:"", email:"" });
    setView("browse");
  };

  const viewDetail = (req) => {
    // Increment view count
    const updated = wanted.map(w => w.id===req.id ? {...w, views:(w.views||0)+1} : w);
    setWanted(updated); saveWanted(updated);
    setDetailReq({...req, views:(req.views||0)+1});
    trackEvent("wanted_viewed", { id: req.id });
  };

  const fmtAgo = ts => {
    const diff = Date.now() - ts;
    const d = Math.floor(diff / 86400000);
    if (d === 0) return "Today";
    if (d === 1) return "Yesterday";
    if (d < 7) return `${d} days ago`;
    if (d < 30) return `${Math.floor(d/7)} week${Math.floor(d/7)>1?"s":""} ago`;
    return `${Math.floor(d/30)} month${Math.floor(d/30)>1?"s":""} ago`;
  };

  if (view === "post") {
    return (
      <div className="wanted-page">
        <div className="wanted-hero">
          <h1>POST A <span>WANTED REQUEST</span></h1>
          <p>Tell us what equipment you're looking for. Your contact details stay <strong style={{color:"#3ec963"}}>100% confidential</strong> — only BLC sees them. Interested sellers/owners contact BLC, and BLC connects you.</p>
        </div>

        <div style={{background:"var(--earth)",border:"1px solid var(--clay)",borderRadius:6,padding:28}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
            <div className="fg"><label>What are you looking for? *</label>
              <select value={form.category} onChange={e=>sf("category",e.target.value)}>
                <option value="">Select category...</option>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="fg"><label>Region *</label>
              <select value={form.region} onChange={e=>sf("region",e.target.value)}>
                <option value="">Select region...</option>
                {REGIONS.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
          </div>

          <div className="fg"><label>City / Town</label>
            <input value={form.location} onChange={e=>sf("location",e.target.value)} placeholder="e.g., Windhoek, Walvis Bay" />
          </div>

          <div className="fg"><label>Request Title *</label>
            <input value={form.title} onChange={e=>sf("title",e.target.value)} placeholder="e.g., 20-ton excavator for road project" maxLength={80} />
            <div style={{fontSize:10,color:"var(--bark)",marginTop:3}}>{form.title.length}/80 — Short and clear</div>
          </div>

          <div className="fg"><label>Detailed Description *</label>
            <textarea rows={5} value={form.description} onChange={e=>sf("description",e.target.value)}
              placeholder="Describe what you need: make/model preferences, duration, specific requirements, project type, etc. The more detail, the better responses you'll get." maxLength={1000} />
            <div style={{fontSize:10,color:"var(--bark)",marginTop:3}}>{form.description.length}/1000</div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
            <div className="fg"><label>Purpose *</label>
              <select value={form.purpose} onChange={e=>sf("purpose",e.target.value)}>
                <option value="buy">Want to Buy</option>
                <option value="hire">Want to Hire/Rent</option>
                <option value="either">Either — Open to Both</option>
              </select>
            </div>
            <div className="fg"><label>Urgency *</label>
              <select value={form.urgency} onChange={e=>sf("urgency",e.target.value)}>
                <option value="urgent">🔥 Urgent — Need within 1 week</option>
                <option value="within_month">📅 Within 1 month</option>
                <option value="flexible">🗓️ Flexible — 1-3 months</option>
              </select>
            </div>
          </div>

          <div className="fg"><label>Budget / Price Range (optional)</label>
            <input value={form.budget} onChange={e=>sf("budget",e.target.value)} placeholder="e.g., N$500k - N$1M or N$1,500/day" />
            <div style={{fontSize:10,color:"var(--bark)",marginTop:3}}>Showing a range helps sellers respond with realistic offers</div>
          </div>

          <div style={{background:"rgba(34,160,144,.08)",border:"1px solid var(--teal-light)",borderRadius:4,padding:"14px 18px",margin:"18px 0",fontSize:12,color:"var(--sand)",lineHeight:1.7}}>
            🔒 <strong style={{color:"var(--teal-light)"}}>Your Privacy is Protected</strong><br/>
            Your name, phone and email below are <strong>NEVER shown publicly</strong>. Only BLC admin sees them. When a seller responds, BLC contacts you on their behalf. This prevents spam and keeps your identity safe.
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
            <div className="fg"><label>Your Name * <span style={{color:"var(--bark)",fontWeight:400,fontSize:10}}>(private)</span></label>
              <input value={form.name} onChange={e=>sf("name",e.target.value)} placeholder="Full name" />
            </div>
            <div className="fg"><label>Phone * <span style={{color:"var(--bark)",fontWeight:400,fontSize:10}}>(private)</span></label>
              <input value={form.phone} onChange={e=>sf("phone",e.target.value)} placeholder="+264 ..." />
            </div>
          </div>

          <div className="fg"><label>Email <span style={{color:"var(--bark)",fontWeight:400,fontSize:10}}>(private, optional)</span></label>
            <input value={form.email} onChange={e=>sf("email",e.target.value)} placeholder="your@email.com" />
          </div>

          {err && <div style={{background:"rgba(183,28,28,.15)",color:"#ef9a9a",padding:"10px 14px",borderRadius:3,fontSize:12,marginBottom:14}}>⚠ {err}</div>}

          <div style={{display:"flex",gap:12,marginTop:16,flexWrap:"wrap"}}>
            <button className="btn-primary" onClick={submit} style={{flex:1,minWidth:200,justifyContent:"center",background:"linear-gradient(135deg,#3ec963,#187530)",color:"#fff"}}>
              📮 Submit Request (FREE)
            </button>
            <button className="btn-outline" onClick={()=>setView("browse")}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wanted-page">
      <div className="wanted-hero">
        <h1>EQUIPMENT <span>WANTED</span> BOARD</h1>
        <p>Can't find what you need? Post a <strong style={{color:"#3ec963"}}>FREE wanted request</strong> and BLC will help you find it. Browse requests from other buyers below — owners, if you have what they need, contact BLC.</p>
        <div className="wanted-cta-row">
          <button className="btn-primary" onClick={()=>setView("post")} style={{background:"linear-gradient(135deg,#3ec963,#187530)",color:"#fff",padding:"14px 28px",fontSize:13}}>
            ➕ Post a Wanted Request (Free)
          </button>
        </div>
      </div>

      <div className="wanted-stats-bar">
        <div className="wanted-stat"><div className="wanted-stat-n">{approved.length}</div><div className="wanted-stat-l">Active Requests</div></div>
        <div className="wanted-stat"><div className="wanted-stat-n" style={{color:"#ef9a9a"}}>{approved.filter(w=>w.urgency==="urgent").length}</div><div className="wanted-stat-l">Urgent</div></div>
        <div className="wanted-stat"><div className="wanted-stat-n" style={{color:"#81c784"}}>{approved.filter(w=>w.purpose==="buy"||w.purpose==="either").length}</div><div className="wanted-stat-l">Want to Buy</div></div>
        <div className="wanted-stat"><div className="wanted-stat-n" style={{color:"#81d4fa"}}>{approved.filter(w=>w.purpose==="hire"||w.purpose==="either").length}</div><div className="wanted-stat-l">Want to Hire</div></div>
      </div>

      <div className="wanted-filters">
        <input type="search" placeholder="🔍 Search requests..." value={search} onChange={e=>setSearch(e.target.value)} style={{flex:"1 1 200px",minWidth:160}} />
        <select value={filterPurpose} onChange={e=>setFilterPurpose(e.target.value)}>
          <option value="all">All Purposes</option>
          <option value="buy">Want to Buy</option>
          <option value="hire">Want to Hire</option>
        </select>
        <select value={filterCategory} onChange={e=>setFilterCategory(e.target.value)}>
          <option value="All">All Categories</option>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <select value={filterRegion} onChange={e=>setFilterRegion(e.target.value)}>
          <option value="All">All Regions</option>
          {REGIONS.map(r => <option key={r}>{r}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">📭</div>
          <h3>No requests match your filters</h3>
          <p>Be the first to post — it's free and gets you in front of suppliers across Namibia.</p>
        </div>
      ) : (
        <div className="wanted-grid">
          {filtered.map(req => {
            const urgencyClass = req.urgency === "urgent" ? "urgent" : req.urgency === "within_month" ? "within_month" : "flexible";
            const urgencyBadge = req.urgency === "urgent" ? "🔥 URGENT" : req.urgency === "within_month" ? "📅 THIS MONTH" : "🗓 FLEXIBLE";
            const badgeClass = req.urgency === "urgent" ? "wanted-urgent-badge" : req.urgency === "within_month" ? "wanted-soon-badge" : "wanted-flex-badge";
            const purposeLabel = req.purpose === "buy" ? "💰 BUY" : req.purpose === "hire" ? "🔑 HIRE" : "💰🔑 EITHER";
            const purposeClass = req.purpose === "buy" ? "wp-buy" : req.purpose === "hire" ? "wp-hire" : "wp-either";
            return (
              <div key={req.id} className={`wanted-card ${urgencyClass}`} onClick={()=>viewDetail(req)}>
                <div>
                  <span className={`wanted-urgency ${badgeClass}`}>{urgencyBadge}</span>
                  <span className={`wanted-purpose-pill ${purposeClass}`}>{purposeLabel}</span>
                </div>
                <div className="wanted-title">{req.title}</div>
                <div className="wanted-meta">
                  <span>{CAT_ICONS[req.category]||"⚙️"} {req.category}</span>
                  <span>📍 {req.location||req.region}, {req.region}</span>
                </div>
                <div className="wanted-desc">{req.description}</div>
                {req.budget && <div className="wanted-budget">💵 Budget: {req.budget}</div>}
                <div className="wanted-footer">
                  <span className="wanted-identity-hidden">🔒 Identity Protected</span>
                  <span>{fmtAgo(req.submittedAt)} · 👁 {req.views||0}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail modal for a wanted request */}
      {detailReq && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setDetailReq(null)}>
          <div className="modal-box" style={{maxWidth:640}}>
            <button className="modal-close" onClick={()=>setDetailReq(null)}>×</button>
            <div style={{padding:"8px 0 16px"}}>
              <span className={`wanted-urgency ${detailReq.urgency==="urgent"?"wanted-urgent-badge":detailReq.urgency==="within_month"?"wanted-soon-badge":"wanted-flex-badge"}`}>
                {detailReq.urgency==="urgent"?"🔥 URGENT":detailReq.urgency==="within_month"?"📅 THIS MONTH":"🗓 FLEXIBLE"}
              </span>
              <span className={`wanted-purpose-pill ${detailReq.purpose==="buy"?"wp-buy":detailReq.purpose==="hire"?"wp-hire":"wp-either"}`}>
                {detailReq.purpose==="buy"?"💰 BUY":detailReq.purpose==="hire"?"🔑 HIRE":"💰🔑 EITHER"}
              </span>
              <span style={{marginLeft:10,fontSize:10,color:"var(--bark)"}}>Ref: {genWantedRef(detailReq.id)}</span>
            </div>
            <h2 style={{fontFamily:"Oswald,sans-serif",color:"var(--ivory)",letterSpacing:"1px",marginBottom:14}}>{detailReq.title}</h2>
            
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:18}}>
              <div className="ii"><label>Category</label><p>{CAT_ICONS[detailReq.category]||"⚙️"} {detailReq.category}</p></div>
              <div className="ii"><label>Region</label><p>📍 {detailReq.region}</p></div>
              {detailReq.location && <div className="ii"><label>Location</label><p>{detailReq.location}</p></div>}
              {detailReq.budget && <div className="ii"><label>Budget</label><p style={{color:"var(--teal-light)",fontWeight:700}}>{detailReq.budget}</p></div>}
            </div>

            <div className="modal-section-title">📋 Request Details</div>
            <p style={{color:"var(--dust)",lineHeight:1.7,fontSize:14,marginBottom:20}}>{detailReq.description}</p>

            <div style={{background:"rgba(232,146,12,.08)",border:"2px solid var(--horizon)",borderRadius:4,padding:"16px 20px",marginBottom:18,textAlign:"center"}}>
              <div style={{fontFamily:"Oswald,sans-serif",fontSize:14,color:"var(--horizon)",letterSpacing:"1.5px",marginBottom:8}}>🔒 BUYER IDENTITY PROTECTED</div>
              <div style={{fontSize:13,color:"var(--sand)",lineHeight:1.6,marginBottom:14}}>
                To protect buyers from spam, all contact details are held securely by BLC.<br/>
                If you can supply this equipment, <strong style={{color:"var(--ivory)"}}>contact BLC directly</strong> — we'll verify your offering and connect you to the buyer.
              </div>
              <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
                <a href={`tel:+264816034139`} className="btn-primary" style={{textDecoration:"none"}}>📞 Call BLC</a>
                <a href={`https://wa.me/264816034139?text=${encodeURIComponent(`Hi BLC, I can supply the equipment requested in Wanted Ref ${genWantedRef(detailReq.id)}: ${detailReq.title}. My offering: `)}`} target="_blank" rel="noreferrer" className="btn-outline" style={{textDecoration:"none"}}>💬 WhatsApp BLC</a>
                <a href={`mailto:blc.bertus@gmail.com?subject=${encodeURIComponent(`Offering for Wanted Ref ${genWantedRef(detailReq.id)}`)}&body=${encodeURIComponent(`Hi BLC,\n\nI can supply the equipment requested: ${detailReq.title}\n\nMy equipment: \nCondition: \nPrice: \n\nKind regards`)}`} className="btn-outline" style={{textDecoration:"none"}}>✉ Email BLC</a>
              </div>
            </div>

            <div style={{fontSize:11,color:"var(--bark)",textAlign:"center"}}>
              Posted {fmtAgo(detailReq.submittedAt)} · {detailReq.views||0} views
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN WANTED PANEL — Review, approve, reject, view buyer contact details
// ─────────────────────────────────────────────────────────────────────────────
function AdminWantedPanel({ wanted, setWanted }) {
  const [filter, setFilter] = useState("pending");
  
  const pending  = wanted.filter(w => w.status === "pending");
  const approved = wanted.filter(w => w.status === "approved");
  const rejected = wanted.filter(w => w.status === "rejected" || w.status === "fulfilled");

  const display = filter==="pending" ? pending : filter==="approved" ? approved : rejected;

  const approve = (id) => {
    const u = wanted.map(w => w.id===id ? {...w, status:"approved", approvedAt:Date.now()} : w);
    setWanted(u); saveWanted(u);
    const req = u.find(w => w.id===id);
    if (req?.phone) queueSms(req.phone, `BLC Plant Hire: Your wanted request "${req.title}" is now LIVE. Interested sellers will contact BLC. Ref: ${genWantedRef(id)}. +264 81 603 4139`, "wanted_approved");
  };

  const reject = (id) => {
    const reason = window.prompt("Reason for rejection (optional, will be sent to buyer):");
    if (reason === null) return;
    const u = wanted.map(w => w.id===id ? {...w, status:"rejected", rejectedAt:Date.now(), rejectionReason:reason} : w);
    setWanted(u); saveWanted(u);
    const req = u.find(w => w.id===id);
    if (req?.phone) queueSms(req.phone, `BLC Plant Hire: Your wanted request "${req.title}" needs revision. ${reason||"Please contact BLC."} +264 81 603 4139`, "wanted_rejected");
  };

  const markFulfilled = (id) => {
    if (!window.confirm("Mark this request as FULFILLED? (Request will be removed from public view)")) return;
    const u = wanted.map(w => w.id===id ? {...w, status:"fulfilled", fulfilledAt:Date.now()} : w);
    setWanted(u); saveWanted(u);
  };

  const deleteReq = (id) => {
    if (!window.confirm("Delete this request permanently?")) return;
    const u = wanted.filter(w => w.id!==id);
    setWanted(u); saveWanted(u);
  };

  const fmtDate = ts => new Date(ts).toLocaleString("en-NA",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});

  return (
    <div>
      <div style={{marginBottom:20}}>
        <div style={{fontFamily:"Oswald,sans-serif",fontSize:22,letterSpacing:"1.5px",color:"var(--ivory)"}}>🔍 WANTED REQUESTS</div>
        <div style={{fontSize:12,color:"var(--sand)",marginTop:4}}>Equipment buyers are asking for. Only you can see their contact details. Approve legitimate requests to make them public.</div>
      </div>

      <div className="revenue-summary" style={{marginBottom:20}}>
        <div className="rev-item"><div className="rev-num" style={{color:"#ff8c42"}}>{pending.length}</div><div className="rev-label">Pending Approval</div></div>
        <div className="rev-item"><div className="rev-num green">{approved.length}</div><div className="rev-label">Live / Public</div></div>
        <div className="rev-item"><div className="rev-num" style={{color:"#81c784"}}>{wanted.filter(w=>w.status==="fulfilled").length}</div><div className="rev-label">Fulfilled</div></div>
        <div className="rev-item"><div className="rev-num">{approved.reduce((s,w)=>s+(w.views||0),0)}</div><div className="rev-label">Total Views</div></div>
      </div>

      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
        <button className={`admin-tab${filter==="pending"?" active":""}`} onClick={()=>setFilter("pending")}>
          ⏳ Pending {pending.length>0 && <span className="bc" style={{background:"#ef4444",color:"#fff"}}>{pending.length}</span>}
        </button>
        <button className={`admin-tab${filter==="approved"?" active":""}`} onClick={()=>setFilter("approved")}>✅ Public ({approved.length})</button>
        <button className={`admin-tab${filter==="closed"?" active":""}`} onClick={()=>setFilter("closed")}>✕ Closed ({rejected.length})</button>
      </div>

      {display.length === 0 ? (
        <div className="empty"><div className="empty-icon">🔍</div><h3>No {filter} requests</h3></div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {display.slice().sort((a,b)=>b.submittedAt-a.submittedAt).map(req => {
            const urgencyBadge = req.urgency === "urgent" ? "🔥 URGENT" : req.urgency === "within_month" ? "📅 MONTH" : "🗓 FLEX";
            return (
              <div key={req.id} style={{background:"var(--earth)",border:`1px solid ${req.status==="pending"?"#ff8c42":"var(--clay)"}`,borderRadius:6,padding:18}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10,marginBottom:12}}>
                  <div style={{flex:"1 1 60%",minWidth:240}}>
                    <div style={{marginBottom:6,display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                      <span className={`wanted-urgency ${req.urgency==="urgent"?"wanted-urgent-badge":req.urgency==="within_month"?"wanted-soon-badge":"wanted-flex-badge"}`}>{urgencyBadge}</span>
                      <span className={`wanted-purpose-pill ${req.purpose==="buy"?"wp-buy":req.purpose==="hire"?"wp-hire":"wp-either"}`}>{req.purpose==="buy"?"💰 BUY":req.purpose==="hire"?"🔑 HIRE":"💰🔑 EITHER"}</span>
                      <span style={{fontSize:10,color:"var(--bark)"}}>{genWantedRef(req.id)}</span>
                      {req.status==="approved" && <span style={{fontSize:10,color:"var(--sand)"}}>👁 {req.views||0} views</span>}
                    </div>
                    <div style={{fontFamily:"Oswald,sans-serif",fontSize:17,color:"var(--ivory)",marginBottom:4}}>{req.title}</div>
                    <div style={{fontSize:11,color:"var(--sand)",marginBottom:8}}>{CAT_ICONS[req.category]||"⚙️"} {req.category} · 📍 {req.location||req.region}, {req.region}</div>
                    <div style={{fontSize:13,color:"var(--dust)",lineHeight:1.6,marginBottom:10}}>{req.description}</div>
                    {req.budget && <div style={{fontSize:12,color:"var(--teal-light)",fontWeight:700,marginBottom:8}}>💵 Budget: {req.budget}</div>}
                  </div>
                  <div style={{fontSize:10,color:"var(--bark)",textAlign:"right"}}>{fmtDate(req.submittedAt)}</div>
                </div>

                {/* ADMIN-ONLY: Buyer contact details */}
                <div style={{background:"linear-gradient(135deg,rgba(232,146,12,.1) 0%,rgba(232,146,12,.04) 100%)",border:"1px solid var(--horizon)",borderRadius:4,padding:"12px 16px",marginBottom:10}}>
                  <div style={{fontSize:10,color:"var(--horizon)",letterSpacing:"1.5px",textTransform:"uppercase",marginBottom:8,fontWeight:700}}>🔐 Admin-Only · Buyer Contact</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10,fontSize:12}}>
                    <div><span style={{color:"var(--sand)",fontSize:10}}>Name</span><br/><strong style={{color:"var(--ivory)"}}>{req.name}</strong></div>
                    <div><span style={{color:"var(--sand)",fontSize:10}}>Phone</span><br/><a href={`tel:${req.phone}`} style={{color:"var(--horizon)"}}>{req.phone}</a></div>
                    {req.email && <div><span style={{color:"var(--sand)",fontSize:10}}>Email</span><br/><a href={`mailto:${req.email}`} style={{color:"var(--horizon)",fontSize:11}}>{req.email}</a></div>}
                  </div>
                </div>

                {req.rejectionReason && (
                  <div style={{background:"rgba(183,28,28,.1)",border:"1px solid #ef4444",borderRadius:3,padding:"8px 12px",marginBottom:10,fontSize:12,color:"#ef9a9a"}}>
                    <strong>Rejection reason:</strong> {req.rejectionReason}
                  </div>
                )}

                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {req.status==="pending" && (
                    <>
                      <button className="btn-primary" onClick={()=>approve(req.id)} style={{background:"linear-gradient(135deg,#3ec963,#187530)",color:"#fff"}}>✓ Approve &amp; Publish</button>
                      <button className="btn-outline" onClick={()=>reject(req.id)} style={{color:"#ef9a9a",borderColor:"#ef4444"}}>✕ Reject</button>
                    </>
                  )}
                  {req.status==="approved" && (
                    <>
                      <button className="btn-primary" onClick={()=>markFulfilled(req.id)} style={{background:"var(--teal-light)",color:"var(--soil)"}}>✅ Mark Fulfilled</button>
                      <a href={`tel:${req.phone}`} className="btn-muted" style={{textDecoration:"none",display:"inline-flex",alignItems:"center",gap:6}}>📞 Call Buyer</a>
                      <a href={`https://wa.me/${req.phone.replace(/\D/g,"")}?text=${encodeURIComponent(`Hi ${req.name}, this is BLC regarding your wanted request for ${req.title}. We have a potential match...`)}`} target="_blank" rel="noreferrer" className="btn-muted" style={{textDecoration:"none",display:"inline-flex",alignItems:"center",gap:6,background:"#25d366",color:"#fff"}}>💬 WhatsApp</a>
                    </>
                  )}
                  <button className="btn-muted" onClick={()=>deleteReq(req.id)}>🗑</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
function AdminPage({ listings, setListings, interests, setInterests, chats, setChats, ratings, ads, setAds, bookings, setBookings, bids, setBids, requests, setRequests }) {
  const [tab, setTab] = useState("pending");

  const pending  = listings.filter(l => l.status === "pending");
  const approved = listings.filter(l => l.status === "approved");
  const rejected = listings.filter(l => l.status === "rejected");
  const unreadLeads = interests.filter(i => !i.read).length;
  const unreadChats = Object.values(chats).reduce((s,msgs) => s + msgs.filter(m => m.from==="user" && !m.readByAdmin).length, 0);

  const update = (id, patch) => { const u = listings.map(l => l.id===id?{...l,...patch}:l); setListings(u); saveListings(u); };
  const remove = id => { if (!window.confirm("Delete permanently?")) return; const u = listings.filter(l => l.id!==id); setListings(u); saveListings(u); };
  const markRead = ts => { const u = interests.map(i => i.timestamp===ts?{...i,read:true}:i); setInterests(u); saveInterests(u); };
  const handleAdminReply = (sessionId, msg, overrideChats) => {
    if (overrideChats) { setChats(overrideChats); saveChats(overrideChats); return; }
    if (!sessionId || !msg) return;
    const updated = { ...chats, [sessionId]: [...(chats[sessionId]||[]), msg] };
    setChats(updated); saveChats(updated);
  };

  const display = tab==="pending"?pending:tab==="approved"?approved:tab==="rejected"?rejected:null;

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-title">ADMIN <span>PANEL</span></div>
        <div className="admin-tabs">
          <button className={`admin-tab${tab==="analytics"?" active":""}`} onClick={() => setTab("analytics")} style={{background:tab==="analytics"?"var(--savanna)":"transparent",borderColor:tab==="analytics"?"var(--savanna)":"var(--clay)",color:tab==="analytics"?"var(--soil)":"var(--sand)"}}>
            📊 Analytics
          </button>
          {[["pending",pending],["approved",approved],["rejected",rejected]].map(([t,arr]) => (
            <button key={t} className={`admin-tab${tab===t?" active":""}`} onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase()+t.slice(1)} <span className="bc">{arr.length}</span>
            </button>
          ))}
          <button className={`admin-tab${tab==="leads"?" active":""}`} onClick={() => setTab("leads")} style={{position:"relative"}}>
            Leads {unreadLeads > 0 && <span className="bc" style={{background:"#ef4444",color:"#fff"}}>{unreadLeads}</span>}
          </button>
          <button className={`admin-tab${tab==="chat"?" active":""}`} onClick={() => setTab("chat")} style={{position:"relative"}}>
            Chat {unreadChats > 0 && <span className="bc" style={{background:"#ef4444",color:"#fff"}}>{unreadChats}</span>}
          </button>
          <button className={`admin-tab${tab==="ads"?" active":""}`} onClick={() => setTab("ads")}>
            📢 Ads {ads.filter(a=>a.adStatus==="pending").length > 0 && <span className="bc" style={{background:"#ef4444",color:"#fff"}}>{ads.filter(a=>a.adStatus==="pending").length}</span>}{ads.filter(a=>a.adStatus==="pending").length===0 && <span className="bc">{ads.filter(a=>a.active).length}</span>}
          </button>
          <button className={`admin-tab${tab==="bookings"?" active":""}`} onClick={() => setTab("bookings")}>
            📅 Bookings {bookings.filter(b=>b.status==="pending").length > 0 && <span className="bc" style={{background:"#ef4444",color:"#fff"}}>{bookings.filter(b=>b.status==="pending").length}</span>}
          </button>
          <button className={`admin-tab${tab==="sms"?" active":""}`} onClick={() => setTab("sms")}>
            📱 SMS {loadSmsLog().filter(s=>!s.sent).length > 0 && <span className="bc" style={{background:"#ef4444",color:"#fff"}}>{loadSmsLog().filter(s=>!s.sent).length}</span>}
          </button>
          <button className={`admin-tab${tab==="import"?" active":""}`} onClick={() => setTab("import")}>
            📥 Import
          </button>
          <button className={`admin-tab${tab==="bids"?" active":""}`} onClick={() => setTab("bids")}>
            🔨 Bids {bids.filter(b=>b.status==="pending").length > 0 && <span className="bc" style={{background:"#ff6b00",color:"#fff"}}>{bids.filter(b=>b.status==="pending").length}</span>}
          </button>
          <button className={`admin-tab${tab==="wanted"?" active":""}`} onClick={() => setTab("wanted")}>
            🔍 Wanted {wanted.filter(w=>w.status==="pending").length > 0 && <span className="bc" style={{background:"#3ec963",color:"#fff"}}>{wanted.filter(w=>w.status==="pending").length}</span>}
          </button>
        </div>
      </div>

      {tab === "analytics" && <AnalyticsDashboard listings={listings} bookings={bookings} interests={interests} ads={ads} chats={chats} ratings={ratings} />}
      {tab === "leads" && <AdminLeadsPanel interests={interests} onMarkRead={markRead} />}
      {tab === "chat" && <AdminChatPanel chats={chats} onReply={handleAdminReply} />}
      {tab === "ads" && <AdminAdsPanel ads={ads} setAds={setAds} />}
      {tab === "bookings" && <AdminBookingsPanel bookings={bookings} setBookings={setBookings} listings={listings} />}
      {tab === "sms" && <SmsNotificationsPanel />}
      {tab === "import" && <BulkImportPanel listings={listings} setListings={setListings} />}
      {tab === "bids" && <AdminBidsPanel bids={bids} setBids={setBids} listings={listings} />}
      {tab === "wanted" && <AdminWantedPanel wanted={wanted} setWanted={setWanted} />}

      {display && (
        display.length === 0 ? (
          <div className="empty"><div className="empty-icon">📭</div><h3>No {tab} listings</h3></div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr><th>Equipment</th><th>Type</th><th>Tier</th><th>Rating</th><th>Interests</th><th>Category</th><th>Region</th><th>Price</th><th>Owner Contact</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {display.map(l => {
                const avg = avgRating(ratings, l.id);
                const rCount = (ratings[l.id]||[]).length;
                const iCount = interests.filter(i => i.listingId === l.id).length;
                return (
                  <tr key={l.id}>
                    <td>
                      <div style={{fontWeight:700}}>{l.name}</div>
                      <div style={{fontSize:11,color:"var(--sand)",marginTop:2}}>{l.year&&`${l.year} · `}{l.condition}{l.hours?` · ${parseInt(l.hours).toLocaleString()}hrs`:""}</div>
                      <div style={{fontSize:11,color:"var(--bark)",marginTop:2}}>{l.images?.length>0?`📷 ${l.images.length}`:"No photos"} · {new Date(l.submittedAt).toLocaleDateString()}</div>
                      {l.ownerAgreementAccepted && <div style={{fontSize:10,color:"#81c784",marginTop:2}}>✅ Owner agreement signed</div>}
                      {!l.ownerAgreementAccepted && <div style={{fontSize:10,color:"#ef9a9a",marginTop:2}}>⚠ No owner agreement</div>}
                    </td>
                    <td><span className={`lt-pill ${l.listingType==="sale"?"lt-sale":"lt-hire"}`}>{l.listingType==="sale"?"🏷 Sale":"🔑 Hire"}</span></td>
                    <td>
                      <span className={`tier-admin-pill tp-${l.tier||"free"}`}>{l.tier==="premium"?"⭐ Premium":l.tier==="featured"?"★ Featured":"Free"}</span>
                      {l.tier&&l.tier!=="free"&&<div style={{fontSize:10,color:"var(--bark)",marginTop:2}}>N${TIERS[l.tier]?.price}/mo</div>}
                    </td>
                    <td>
                      {avg ? <span style={{color:"var(--gold)",fontSize:12}}>{"★".repeat(Math.floor(avg))} {avg}<br/><span style={{color:"var(--bark)",fontSize:10}}>{rCount} review{rCount!==1?"s":""}</span></span>
                           : <span style={{color:"var(--bark)",fontSize:11}}>No ratings</span>}
                    </td>
                    <td>
                      {iCount > 0
                        ? <span style={{color:"var(--horizon)",fontWeight:700,fontSize:13}}>{iCount} lead{iCount!==1?"s":""}</span>
                        : <span style={{color:"var(--bark)",fontSize:11}}>None yet</span>}
                    </td>
                    <td>{l.category}</td>
                    <td>{l.region}<br/><span style={{fontSize:11,color:"var(--sand)"}}>{l.location}</span></td>
                    <td style={{fontFamily:"Oswald,sans-serif",color:l.listingType==="sale"?"var(--teal-light)":"var(--horizon)"}}>
                      N$ {parseInt(l.price).toLocaleString()}
                      {l.listingType==="hire"&&<><br/><span style={{fontSize:10,color:"var(--sand)",fontFamily:"Lato"}}>/{l.unit}</span></>}
                      {l.listingType==="sale"&&l.negotiable&&<><br/><span style={{fontSize:10,color:"var(--teal-light)",fontFamily:"Lato"}}>Neg.</span></>}
                    </td>
                    <td style={{fontSize:12}}>
                      <div style={{background:"var(--soil)",padding:"8px 10px",borderRadius:3,border:"1px solid var(--clay)"}}>
                        <div>📞 <a href={`tel:${l.contact}`} style={{color:"var(--horizon)",textDecoration:"none",fontWeight:700}}>{l.contact}</a></div>
                        {l.email&&<div>✉ <a href={`mailto:${l.email}`} style={{color:"var(--teal-light)",textDecoration:"none",fontWeight:700,fontSize:11}}>{l.email}</a></div>}
                      </div>
                    </td>
                    <td><span className={`status-pill pill-${l.status}`}>{l.status}</span></td>
                    <td>
                      <div className="action-btns">
                        {l.status!=="approved"&&<button className="btn-approve" onClick={()=>update(l.id,{status:"approved"})}>✓ Approve</button>}
                        {l.status!=="rejected"&&<button className="btn-reject" onClick={()=>update(l.id,{status:"rejected"})}>✕ Reject</button>}
                        {l.status==="approved"&&<><button className="btn-muted" onClick={()=>update(l.id,{tier:"premium",featured:true})}>⭐ Premium</button><button className="btn-muted" onClick={()=>update(l.id,{tier:"featured",featured:true})}>★ Featured</button><button className="btn-muted" onClick={()=>update(l.id,{tier:"free",featured:false})}>Free</button></>}
                        {l.status==="approved"&&l.listingType==="sale"&&!l.sold&&<button className="btn-reject" style={{borderColor:"#ef4444",color:"#ef4444"}} onClick={()=>{ if(window.confirm("Mark this item as SOLD? This will show a SOLD stamp on the listing.")) update(l.id,{sold:true});}}>🚫 Mark Sold</button>}
                        {l.status==="approved"&&l.listingType==="sale"&&l.sold&&<button className="btn-muted" onClick={()=>update(l.id,{sold:false})}>↩ Unmark Sold</button>}
                        <button className="btn-muted" onClick={()=>remove(l.id)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────────────────────────
function LoginModal({ onSuccess, onCancel }) {
  const [pw,setPw]=useState(""); const [err,setErr]=useState(false);
  const go=()=>{if(pw===ADMIN_PASSWORD)onSuccess();else{setErr(true);setPw("");}};
  return (
    <div className="login-overlay">
      <div className="login-box">
        <div style={{display:"flex",justifyContent:"center",marginBottom:14}}>
          <BlcLogoMark size={64} />
        </div>
        <h3 style={{textAlign:"center"}}>🔒 ADMIN ACCESS</h3>
        <p style={{textAlign:"center"}}>Restricted to <span style={{color:"#2d7fd4",fontWeight:700}}>BLC</span> <span style={{color:"#3ec963",fontWeight:700}}>Plant Hire</span> staff only.</p>
        {err&&<div className="login-err">Incorrect password. Try again.</div>}
        <div className="fg" style={{marginBottom:20}}><label>Admin Password</label><input type="password" value={pw} placeholder="••••••••" onChange={e=>{setPw(e.target.value);setErr(false);}} onKeyDown={e=>e.key==="Enter"&&go()} autoFocus /></div>
        <div style={{display:"flex",gap:12}}><button className="btn-primary" onClick={go} style={{flex:1,justifyContent:"center"}}>Unlock</button><button className="btn-outline" onClick={onCancel}>Cancel</button></div>
        <p style={{fontSize:11,color:"var(--bark)",marginTop:14,textAlign:"center"}}>Demo: <code style={{color:"var(--sand)"}}>BLC@Admin2026</code></p>
      </div>
    </div>
  );
}

function Toast({ msg, isSale, onDone }) {
  useEffect(()=>{const t=setTimeout(onDone,3500);return()=>clearTimeout(t);},[onDone]);
  return <div className={`toast${isSale?" st":""}`}>✓ {msg}</div>;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage]           = useState("browse");
  const [browseTab, setBrowseTab] = useState("all");
  const [listings, setListings]   = useState(loadListings);
  const [interests, setInterests] = useState(loadInterests);
  const [ratings, setRatings]     = useState(loadRatings);
  const [chats, setChats]         = useState(loadChats);
  const [ads, setAds]             = useState(loadAds);
  const [bookings, setBookings]   = useState(loadBookings);
  const [bids, setBids]           = useState(loadBids);
  const [requests, setRequests]   = useState(() => {
    const saved = loadRequests();
    if (saved.length === 0) { saveRequests(SEED_REQUESTS); return SEED_REQUESTS; }
    return saved;
  });
  const [wanted, setWanted]       = useState(loadWanted);
  const [search, setSearch]       = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [regionFilter, setRegionFilter] = useState("All");
  const [selected, setSelected]   = useState(null);
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [toast, setToast]         = useState(null);
  const [sessionId]               = useState(() => "sess_" + Math.random().toString(36).slice(2));
  const [lang, setLang]           = useState(loadLang);

  const changeLang = (l) => { setLang(l); saveLang(l); };

  const approved  = listings.filter(l => l.status === "approved");
  const hireCount = approved.filter(l => l.listingType === "hire").length;
  const saleCount = approved.filter(l => l.listingType === "sale").length;
  const unreadLeads  = interests.filter(i => !i.read).length;
  const unreadChats  = Object.values(chats).reduce((s,msgs) => s + msgs.filter(m => m.from==="user" && !m.readByAdmin).length, 0);

  const filtered = sortByTier(approved.filter(l => {
    const q = search.toLowerCase();
    const ms = !q || l.name.toLowerCase().includes(q) || l.description.toLowerCase().includes(q) || l.location.toLowerCase().includes(q);
    const mc = catFilter==="All" || l.category===catFilter;
    const mr = regionFilter==="All" || l.region===regionFilter;
    const mt = browseTab==="all" || l.listingType===browseTab;
    return ms && mc && mr && mt;
  }));

  const goAdmin = () => { if (adminAuthed) setPage("admin"); else setShowLogin(true); };

  // Track page views
  useEffect(() => { trackEvent("page_view", { page }); }, [page]);

  // Track listing views
  const handleListingClick = (listing) => {
    trackEvent("listing_view", { listingId: listing.id, listingName: listing.name, listingType: listing.listingType });
    setSelected(listing);
  };

  const handleInterestSubmit = (interest) => {
    const updated = [...interests, interest];
    setInterests(updated); saveInterests(updated);
    trackEvent("lead", { listingId: interest.listingId, listingName: interest.listingName });
  };

  const handleRating = (listingId, stars, name) => {
    const updated = { ...ratings, [listingId]: [...(ratings[listingId]||[]), { stars, name, ts:Date.now() }] };
    setRatings(updated); saveRatings(updated);
    trackEvent("rating", { listingId, stars });
  };

  const handleChatSend = (sessionId, msg) => {
    const updated = { ...chats, [sessionId]: [...(chats[sessionId]||[]), msg] };
    setChats(updated); saveChats(updated);
    trackEvent("chat_message", { sessionId });
  };

  const handleBook = (booking) => {
    const updated = [...bookings, booking];
    setBookings(updated); saveBookings(updated);
  };

  const handleBidPlaced = (bid) => {
    const updated = [...bids, bid];
    setBids(updated); saveBids(updated);
    setToast({ msg:`Bid of N$${bid.amount.toLocaleString()} submitted — BLC will review within 24 hours.`, isSale:true });
  };

  const handleRequestSubmitted = (req) => {
    const updated = [...requests, req];
    setRequests(updated); saveRequests(updated);
    setToast({ msg:"Request submitted! BLC will review within 24hrs. Your contact stays private.", isSale:false });
    trackEvent("request_submitted", { category: req.category, type: req.requestType });
  };

  return (
    <>
      <style>{css}</style>
      <div className="app">
        {/* NAV */}
        <nav className="nav">
          <div className="logo" onClick={() => setPage("browse")}>
            <div className="logo-mark">
              <BlcLogoMark size={60} />
            </div>
            <div className="logo-text">
              <div className="logo-name">
                <span style={{color:"#2d7fd4"}}>BLC</span>&nbsp;<span style={{color:"#3ec963"}}>PLANT HIRE</span>
              </div>
              <div className="logo-sub">Namibia · Equipment Platform</div>
            </div>
          </div>
          <div className="nav-tabs">
            <button className={`nav-tab${page==="browse"?" active":""}`} onClick={() => setPage("browse")}>{t("nav_browse",lang)}</button>
            <button className={`nav-tab${page==="submit"?" active":""}`} onClick={() => setPage("submit")}>{t("nav_list",lang)}</button>
            <button className={`nav-tab${page==="wanted"?" active":""}`} onClick={() => setPage("wanted")} style={{color:"#3ec963"}}>🔍 Wanted</button>
            <button className={`nav-tab${page==="advertise"?" active":""}`} onClick={() => setPage("advertise")} style={{color:"var(--gold)"}}>{t("nav_advertise",lang)}</button>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <LanguagePicker lang={lang} onChange={changeLang} />
            <button className={`nav-admin-btn${adminAuthed?" locked":""}`} onClick={goAdmin}>
              {adminAuthed ? "⚙ "+t("nav_admin",lang) : "🔒 "+t("nav_admin",lang)}
              {adminAuthed && (unreadLeads+unreadChats+bookings.filter(b=>b.status==="pending").length+ads.filter(a=>a.adStatus==="pending").length) > 0 && <span className="notif-dot" />}
            </button>
          </div>
        </nav>

        <div className="contact-strip">
          <a href="tel:+264816034139">📞 +264 81 603 4139</a>
          <a href="mailto:blc.bertus@gmail.com">✉ blc.bertus@gmail.com</a>
        </div>

        {/* BROWSE */}
        {page === "browse" && (
          <>
            <div className="hero">
              <div className="hero-flag">🇳🇦 {t("hero_flag",lang)}</div>
              <h1>{t("hero_title_1",lang)}<span>{t("hero_title_2",lang)}</span></h1>
              <p className="hero-sub">{t("hero_sub",lang)}</p>
              <div className="hero-types">
                <div className={`hero-type-pill hire${browseTab==="hire"?" sel":""}`} onClick={()=>{setBrowseTab("hire");document.querySelector(".main")?.scrollIntoView({behavior:"smooth"});}}>🔑 {t("hero_for_hire",lang)} <span style={{fontSize:11,opacity:.7}}>({hireCount})</span></div>
                <div className={`hero-type-pill sale${browseTab==="sale"?" sel":""}`} onClick={()=>{setBrowseTab("sale");document.querySelector(".main")?.scrollIntoView({behavior:"smooth"});}}>🏷️ {t("hero_for_sale",lang)} <span style={{fontSize:11,opacity:.7}}>({saleCount})</span></div>
              </div>
              <div className="hero-actions">
                <button className="btn-primary" onClick={() => setPage("submit")}>📋 {t("list_equipment",lang)}</button>
                <a href="tel:+264816034139" className="btn-outline" style={{textDecoration:"none",display:"flex",alignItems:"center",gap:6}}>📞 {t("call_blc",lang)}</a>
              </div>
              <div className="hero-contact-row">
                <a href="tel:+264816034139">+264 81 603 4139</a>
                <span style={{color:"var(--clay)"}}>·</span>
                <a href="mailto:blc.bertus@gmail.com">blc.bertus@gmail.com</a>
              </div>
              <div className="hero-stats">
                <div className="stat"><div className="stat-n">{hireCount}</div><div className="stat-l">{t("hero_for_hire",lang)}</div></div>
                <div className="stat"><div className="stat-n tc">{saleCount}</div><div className="stat-l">{t("hero_for_sale",lang)}</div></div>
                <div className="stat"><div className="stat-n">14</div><div className="stat-l">{t("hero_regions",lang)}</div></div>
                <div className="stat"><div className="stat-n">FREE</div><div className="stat-l">{t("hero_free",lang)}</div></div>
              </div>
            </div>

            {/* HERO AD BANNER — between hero and search */}
            <AdHeroBanner ads={ads} />

            <div className="search-wrap">
              <div className="search-bar">
                <div className="sf"><label>Search</label><input placeholder="Equipment name, location..." value={search} onChange={e=>setSearch(e.target.value)} /></div>
                <div className="sf"><label>Category</label><select value={catFilter} onChange={e=>setCatFilter(e.target.value)}><option value="All">All Categories</option>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></div>
                <div className="sf"><label>Region</label><select value={regionFilter} onChange={e=>setRegionFilter(e.target.value)}><option value="All">All Regions</option>{REGIONS.map(r=><option key={r}>{r}</option>)}</select></div>
                <div className="sf"><label>Type</label><select value={browseTab} onChange={e=>setBrowseTab(e.target.value)}><option value="all">Hire &amp; Sale</option><option value="hire">For Hire</option><option value="sale">For Sale</option></select></div>
                <button className="search-go">🔍</button>
              </div>
            </div>

            <div className="type-tabs-wrap">
              <div className="type-tabs">
                <button className={`type-tab hire${browseTab==="all"?" active":""}`} onClick={()=>setBrowseTab("all")}>All <span className="type-count">{approved.length}</span></button>
                <button className={`type-tab hire${browseTab==="hire"?" active":""}`} onClick={()=>setBrowseTab("hire")}>🔑 For Hire <span className="type-count">{hireCount}</span></button>
                <button className={`type-tab sale${browseTab==="sale"?" active":""}`} onClick={()=>setBrowseTab("sale")}>🏷️ For Sale <span className="type-count">{saleCount}</span></button>
              </div>
            </div>

            <div className="main">
              <div className="section-head">
                <div className="section-title">{browseTab==="sale"?<>FOR <span className="sc">SALE</span></>:browseTab==="hire"?<>FOR <span>HIRE</span></>:<>HIRE <span>&amp;</span> <span className="sc">SALE</span></>}</div>
                <div className="count-badge">{filtered.length} listing{filtered.length!==1?"s":""}</div>
              </div>
              <div className="filters">
                <button className={`filt-btn${catFilter==="All"?" active":""}`} onClick={()=>setCatFilter("All")}>All</button>
                {CATEGORIES.slice(0,10).map(c=>(
                  <button key={c} className={`filt-btn${catFilter===c?(browseTab==="sale"?" sactive":" active"):""}`} onClick={()=>setCatFilter(c)}>{c}</button>
                ))}
              </div>
              {filtered.length > 0 ? (
                <div className="listing-grid">
                  {filtered.reduce((acc, l, i) => {
                    acc.push(<ListingCard key={l.id} listing={l} onClick={handleListingClick} ratings={ratings} bids={bids} />);
                    if ((i + 1) % 3 === 0) acc.push(<AdInlineCard key={`ad_${i}`} ads={ads} />);
                    return acc;
                  }, [])}
                </div>
              ) : (
                <div className="empty"><div className="empty-icon">🔍</div><h3>No listings found</h3><p>Try adjusting your search, or list your own equipment above.</p></div>
              )}
            </div>

            {/* FOOTER STRIP AD */}
            <AdFooterStrip ads={ads} />
          </>
        )}

        {page === "submit" && (
          <SubmitPage onSubmitted={(isSale, tier) => {
            setPage("browse");
            setToast({ msg:`${TIERS[tier].label} ${isSale?"sale":"hire"} listing submitted — awaiting BLC review.`, isSale });
          }} />
        )}

        {page === "advertise" && (
          <AdvertisePage onSubmitted={() => setToast({ msg:"Ad request submitted — BLC will review and contact you within 24 hours.", isSale:false })} />
        )}

        {page === "wanted" && (
          <WantedBoardPage requests={requests} onRequestSubmitted={handleRequestSubmitted} listings={listings} />
        )}

        {page === "admin" && adminAuthed && (
          <AdminPage listings={listings} setListings={u=>{setListings(u);saveListings(u);}}
            interests={interests} setInterests={u=>{setInterests(u);saveInterests(u);}}
            chats={chats} setChats={u=>{setChats(u);saveChats(u);}}
            ratings={ratings}
            ads={ads} setAds={u=>{setAds(u);saveAds(u);}}
            bookings={bookings} setBookings={u=>{setBookings(u);saveBookings(u);}}
            bids={bids} setBids={u=>{setBids(u);saveBids(u);}}
            requests={requests} setRequests={u=>{setRequests(u);saveRequests(u);}} />
        )}

        <footer className="footer">
          <p><span style={{color:"#2d7fd4",fontWeight:700}}>BLC</span> <span style={{color:"#3ec963",fontWeight:700}}>Plant Hire</span> · Namibia · All 14 Regions · © {new Date().getFullYear()}</p>
          <div style={{display:"flex",justifyContent:"center",gap:28,marginTop:12,flexWrap:"wrap"}}>
            <a href="tel:+264816034139" style={{color:"var(--horizon)",textDecoration:"none",fontSize:13,fontWeight:700}}>📞 +264 81 603 4139</a>
            <a href="mailto:blc.bertus@gmail.com" style={{color:"var(--horizon)",textDecoration:"none",fontSize:13,fontWeight:700}}>✉ blc.bertus@gmail.com</a>
          </div>
          <p style={{marginTop:10}}>Plant Hire · Equipment Sales · Free | Featured N$150/mo | Premium N$350/mo</p>
          <p style={{marginTop:6,color:"var(--dune)"}}>📢 Advertise here — Unlimited advertisers per slot · Hero Banner from N$700/mo · <a href="mailto:blc.bertus@gmail.com?subject=Advertising Enquiry" style={{color:"var(--horizon)",textDecoration:"none",fontWeight:700}}>Contact BLC</a></p>
        </footer>
      </div>

      {/* DETAIL MODAL */}
      {selected && (
        <DetailModal listing={selected} onClose={() => setSelected(null)}
          ratings={ratings}
          onRateSubmit={handleRating}
          onInterestSubmit={handleInterestSubmit}
          ads={ads}
          bookings={bookings}
          onBook={handleBook}
          interests={interests}
          bids={bids}
          onBidPlaced={handleBidPlaced} />
      )}

      {/* CHAT WIDGET */}
      {page !== "admin" && (
        <ChatWidget chats={chats} onSend={handleChatSend} sessionId={sessionId} />
      )}

      {showLogin && <LoginModal onSuccess={() => { setAdminAuthed(true); setShowLogin(false); setPage("admin"); }} onCancel={() => setShowLogin(false)} />}
      {toast && <Toast msg={toast.msg} isSale={toast.isSale} onDone={() => setToast(null)} />}
    </>
  );
}
