import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const now = new Date();
const year = now.getFullYear();
const daysAgo = (n: number, h = 0) => new Date(now.getTime() - n * 86400000 - h * 3600000);
const daysAhead = (n: number, h = 0) => new Date(now.getTime() + n * 86400000 + h * 3600000);

async function main() {
  console.log("Seeding Property CRM...");
  await db.activity.deleteMany();
  await db.chatMessage.deleteMany();
  await db.task.deleteMany();
  await db.deal.deleteMany();
  await db.lead.deleteMany();
  await db.contact.deleteMany();
  await db.property.deleteMany();
  await db.user.deleteMany();

  const adminPass = await bcrypt.hash("admin123", 10);
  const agentPass = await bcrypt.hash("agent123", 10);

  const admin = await db.user.create({
    data: { name: "Bilal Admin", email: "admin@crm.local", password: adminPass, role: "ADMIN" },
  });
  const sara = await db.user.create({
    data: { name: "Sara Ahmed", email: "sara@crm.local", password: agentPass, role: "SALES" },
  });
  const mike = await db.user.create({
    data: { name: "Mike Chen", email: "mike@crm.local", password: agentPass, role: "SALES" },
  });

  const img = (seed: string) => `https://picsum.photos/seed/${seed}/800/560`;

  const properties = [
    { title: "Luxury Marina View Apartment", type: "APARTMENT", status: "AVAILABLE", listingType: "SALE", price: 845000, bedrooms: 3, bathrooms: 2, area: 1850, address: "100 Bayfront Dr", city: "Miami", state: "FL", zip: "33131", imageUrl: img("marina1"), featured: true, description: "Stunning 3-bed apartment with floor-to-ceiling windows overlooking the marina. Premium finishes, smart home system, and resort-style amenities.", createdAt: daysAgo(160) },
    { title: "Modern Downtown Loft", type: "APARTMENT", status: "AVAILABLE", listingType: "RENT", price: 2650, bedrooms: 2, bathrooms: 2, area: 1150, address: "455 Brickell Ave", city: "Miami", state: "FL", zip: "33131", imageUrl: img("loft2"), featured: false, description: "Industrial-chic loft in the heart of downtown. Exposed brick, open kitchen, walkable to restaurants and metro.", createdAt: daysAgo(120) },
    { title: "Palm Grove Family House", type: "HOUSE", status: "AVAILABLE", listingType: "SALE", price: 1290000, bedrooms: 5, bathrooms: 4, area: 3400, address: "2201 Palm Grove Ln", city: "Coral Gables", state: "FL", zip: "33134", imageUrl: img("house3"), featured: true, description: "Five-bedroom family home on a quiet tree-lined street. New roof, pool, summer kitchen, and a 3-car garage.", createdAt: daysAgo(95) },
    { title: "Sunset Ridge Villa", type: "VILLA", status: "RESERVED", listingType: "SALE", price: 2150000, bedrooms: 6, bathrooms: 5, area: 4800, address: "8 Sunset Ridge Rd", city: "Orlando", state: "FL", zip: "32801", imageUrl: img("villa4"), featured: true, description: "Gated Mediterranean villa with infinity pool, home cinema, wine cellar and golf course views.", createdAt: daysAgo(80) },
    { title: "City Center Commercial Space", type: "COMMERCIAL", status: "AVAILABLE", listingType: "SALE", price: 1750000, bedrooms: 0, bathrooms: 2, area: 5200, address: "301 Main St", city: "Tampa", state: "FL", zip: "33602", imageUrl: img("comm5"), featured: false, description: "Ground-floor retail/commercial space with heavy foot traffic. Currently fitted as a cafe, shell condition available.", createdAt: daysAgo(70) },
    { title: "Lakefront Executive Office", type: "OFFICE", status: "AVAILABLE", listingType: "RENT", price: 4300, bedrooms: 0, bathrooms: 2, area: 2600, address: "77 Lakeview Blvd", city: "Orlando", state: "FL", zip: "32801", imageUrl: img("office6"), featured: false, description: "Fully fitted executive office suite with 4 private rooms, boardroom and lake views. Service charge included.", createdAt: daysAgo(60) },
    { title: "Coastal Cottage Retreat", type: "HOUSE", status: "SOLD", listingType: "SALE", price: 615000, bedrooms: 3, bathrooms: 2, area: 1600, address: "12 Shoreline Ct", city: "Sarasota", state: "FL", zip: "34236", imageUrl: img("cottage7"), featured: false, description: "Charming coastal cottage minutes from the beach. Sold above asking after 9 days on market.", createdAt: daysAgo(150) },
    { title: "Skyline Penthouse", type: "APARTMENT", status: "SOLD", listingType: "SALE", price: 2450000, bedrooms: 4, bathrooms: 4, area: 3900, address: "900 Skyline Way", city: "Miami", state: "FL", zip: "33139", imageUrl: img("pent8"), featured: false, description: "Full-floor penthouse with private elevator, 360-degree skyline views and a 2,000 sq ft terrace.", createdAt: daysAgo(140) },
    { title: "Oakwood Garden Apartment", type: "APARTMENT", status: "RENTED", listingType: "RENT", price: 1980, bedrooms: 1, bathrooms: 1, area: 780, address: "310 Oakwood Ave", city: "Coral Gables", state: "FL", zip: "33134", imageUrl: img("oak9"), featured: false, description: "Bright one-bed garden apartment with private patio entrance. Rented within two weeks of listing.", createdAt: daysAgo(45) },
    { title: "Hilltop Building Plot", type: "PLOT", status: "AVAILABLE", listingType: "SALE", price: 385000, bedrooms: 0, bathrooms: 0, area: 21780, address: "Lot 14 Hilltop Rd", city: "Austin", state: "TX", zip: "78701", imageUrl: img("plot10"), featured: false, description: "Half-acre hilltop plot with city views and utilities at the boundary. Approved for a two-storey residence.", createdAt: daysAgo(35) },
    { title: "Harbor Business Suite", type: "OFFICE", status: "AVAILABLE", listingType: "SALE", price: 920000, bedrooms: 0, bathrooms: 2, area: 2100, address: "58 Harbor Pl", city: "Tampa", state: "FL", zip: "33602", imageUrl: img("harbor11"), featured: false, description: "Strata-titled office suite with 6 parking bays, currently leased to a law firm on a 3-year term.", createdAt: daysAgo(20) },
    { title: "Riverside Duplex", type: "HOUSE", status: "AVAILABLE", listingType: "SALE", price: 720000, bedrooms: 4, bathrooms: 3, area: 2400, address: "145 Riverside Dr", city: "Austin", state: "TX", zip: "78701", imageUrl: img("duplex12"), featured: false, description: "Two-storey duplex with separate entrances — ideal for owner-occupiers wanting rental income.", createdAt: daysAgo(10) },
  ];
  const createdProps: { id: string; title: string; price: number }[] = [];
  for (const p of properties) {
    const i = createdProps.length;
    const created = await db.property.create({
      data: { ...p, ref: `PRP-${year}-${String(i + 1).padStart(4, "0")}`, ownerId: [sara.id, mike.id][Math.floor(Math.random() * 2)] },
    });
    createdProps.push({ id: created.id, title: created.title, price: created.price });
  }

  const contactData = [
    { name: "James Wilson", email: "james.wilson@gmail.com", phone: "+1 305 555 0142", type: "BUYER", address: "Miami, FL", notes: "Relocating from Chicago, wants a family home near good schools.", createdAt: daysAgo(150) },
    { name: "Emma Rodriguez", email: "emma.r@outlook.com", phone: "+1 786 555 0198", type: "SELLER", address: "Coral Gables, FL", notes: "Selling inherited property, flexible on closing timeline.", createdAt: daysAgo(140) },
    { name: "David Thompson", email: "d.thompson@corpmail.com", phone: "+1 407 555 0177", type: "LANDLORD", address: "Orlando, FL", notes: "Owns 3 rental units, open to new listings.", createdAt: daysAgo(100) },
    { name: "Sophia Kim", email: "sophia.kim@gmail.com", phone: "+1 813 555 0166", type: "TENANT", address: "Tampa, FL", notes: "Looking for a 12-month lease, pet-friendly.", createdAt: daysAgo(95) },
    { name: "Omar Farooq", email: "omar.farooq@gmail.com", phone: "+1 305 555 0123", type: "BUYER", address: "Miami Beach, FL", notes: "Cash buyer, investment focused, prefers waterfront.", createdAt: daysAgo(70) },
    { name: "Lisa Anderson", email: "lisa.a@gmail.com", phone: "+1 941 555 0155", type: "BUYER", address: "Sarasota, FL", notes: "First-time buyer, pre-approved for 650k.", createdAt: daysAgo(60) },
    { name: "Robert Martinez", email: "robert.m@bizmail.com", phone: "+1 512 555 0188", type: "VENDOR", address: "Austin, TX", notes: "Contractor — staging and repairs partner.", createdAt: daysAgo(45) },
    { name: "Nina Patel", email: "nina.patel@gmail.com", phone: "+1 305 555 0131", type: "BUYER", address: "Miami, FL", notes: "Upgrading from apartment, wants 4+ beds.", createdAt: daysAgo(15) },
  ];
  const createdContacts = await Promise.all(
    contactData.map((c, i) =>
      db.contact.create({ data: { ...c, ref: `CNT-${year}-${String(i + 1).padStart(4, "0")}` } })
    )
  );

  const leadData = [
    { name: "Michael Brown", email: "m.brown@gmail.com", phone: "+1 305 555 0201", source: "WEBSITE", status: "NEW", budgetMin: 700000, budgetMax: 900000, interest: "3-bed apartment with marina view", propertyId: createdProps[0].id, assignedToId: sara.id, score: 55, createdAt: daysAgo(2) },
    { name: "Jennifer Davis", email: "jen.davis@outlook.com", phone: "+1 786 555 0202", source: "PORTAL", status: "NEW", budgetMin: 2000, budgetMax: 2800, interest: "2-bed rental downtown", propertyId: createdProps[1].id, assignedToId: mike.id, score: 40, createdAt: daysAgo(1) },
    { name: "Christopher Lee", email: "c.lee@gmail.com", phone: "+1 407 555 0203", source: "REFERRAL", status: "CONTACTED", budgetMin: 1800000, budgetMax: 2400000, interest: "Luxury villa, gated community", propertyId: createdProps[3].id, assignedToId: sara.id, score: 75, createdAt: daysAgo(12) },
    { name: "Amanda White", email: "a.white@gmail.com", phone: "+1 813 555 0204", source: "SOCIAL", status: "CONTACTED", budgetMin: 1500000, budgetMax: 1900000, interest: "Commercial space for cafe chain", propertyId: createdProps[4].id, assignedToId: mike.id, score: 60, createdAt: daysAgo(9) },
    { name: "Daniel Garcia", email: "d.garcia@gmail.com", phone: "+1 305 555 0205", source: "WALK_IN", status: "QUALIFIED", budgetMin: 2500, budgetMax: 3500, interest: "Office suite for consulting firm", propertyId: createdProps[5].id, assignedToId: sara.id, score: 80, createdAt: daysAgo(30) },
    { name: "Olivia Martinez", email: "o.martinez@gmail.com", phone: "+1 941 555 0206", source: "REFERRAL", status: "QUALIFIED", budgetMin: 350000, budgetMax: 420000, interest: "Building plot, hilltop preferred", propertyId: createdProps[9].id, assignedToId: mike.id, score: 65, createdAt: daysAgo(25) },
    { name: "Ethan Clark", email: "e.clark@gmail.com", phone: "+1 512 555 0207", source: "CALL", status: "VIEWING", budgetMin: 650000, budgetMax: 780000, interest: "4-bed duplex with rental income", propertyId: createdProps[11].id, assignedToId: sara.id, score: 85, createdAt: daysAgo(18) },
    { name: "Mia Lewis", email: "mia.lewis@gmail.com", phone: "+1 305 555 0208", source: "WEBSITE", status: "NEGOTIATION", budgetMin: 1200000, budgetMax: 1350000, interest: "Family house with pool", propertyId: createdProps[2].id, assignedToId: sara.id, score: 90, createdAt: daysAgo(22) },
    { name: "Noah Hall", email: "n.hall@corpmail.com", phone: "+1 407 555 0209", source: "PORTAL", status: "WON", budgetMin: 800000, budgetMax: 1000000, interest: "Office suite with parking", propertyId: createdProps[10].id, assignedToId: mike.id, score: 95, createdAt: daysAgo(40) },
    { name: "Ava Young", email: "ava.young@gmail.com", phone: "+1 786 555 0210", source: "OTHER", status: "LOST", budgetMin: 2000000, budgetMax: 2600000, interest: "Penthouse — bought elsewhere", propertyId: createdProps[7].id, assignedToId: sara.id, score: 70, createdAt: daysAgo(55) },
  ];
  const createdLeads = await Promise.all(
    leadData.map((l) => db.lead.create({ data: { ...l, contactId: null } }))
  );

  const dealData = [
    { title: "Skyline Penthouse — Sale", value: 2450000, commission: 61250, stage: "CLOSED_WON", type: "SALE", propertyId: createdProps[7].id, contactId: createdContacts[4].id, leadId: createdLeads[9].id, ownerId: mike.id, expectedCloseDate: daysAgo(125), closedAt: daysAgo(125), notes: "Cash deal, closed 3 weeks early.", createdAt: daysAgo(155) },
    { title: "Coastal Cottage — Sale", value: 638000, commission: 15950, stage: "CLOSED_WON", type: "SALE", propertyId: createdProps[6].id, contactId: createdContacts[5].id, ownerId: sara.id, expectedCloseDate: daysAgo(95), closedAt: daysAgo(97), notes: "Above-asking offer accepted.", createdAt: daysAgo(140) },
    { title: "Oakwood Garden — Lease", value: 23760, commission: 2376, stage: "CLOSED_WON", type: "RENT", propertyId: createdProps[8].id, contactId: createdContacts[3].id, ownerId: mike.id, expectedCloseDate: daysAgo(30), closedAt: daysAgo(28), notes: "12-month lease signed.", createdAt: daysAgo(42) },
    { title: "Harbor Business Suite — Sale", value: 920000, commission: 27600, stage: "CLOSING", type: "SALE", propertyId: createdProps[10].id, contactId: createdContacts[6].id, leadId: createdLeads[8].id, ownerId: mike.id, expectedCloseDate: daysAhead(12), notes: "Title search done, awaiting bank letter.", createdAt: daysAgo(38) },
    { title: "Palm Grove House — Sale", value: 1275000, commission: 38250, stage: "CONTRACT", type: "SALE", propertyId: createdProps[2].id, contactId: createdContacts[0].id, leadId: createdLeads[7].id, ownerId: sara.id, expectedCloseDate: daysAhead(25), notes: "Contract drafted, inspection scheduled.", createdAt: daysAgo(20) },
    { title: "Sunset Ridge Villa — Sale", value: 2100000, commission: 63000, stage: "DUE_DILIGENCE", type: "SALE", propertyId: createdProps[3].id, contactId: createdContacts[2].id, leadId: createdLeads[2].id, ownerId: sara.id, expectedCloseDate: daysAhead(45), notes: "Survey and structural report in progress.", createdAt: daysAgo(11) },
    { title: "City Center Commercial — Sale", value: 1690000, commission: 50700, stage: "OFFER_MADE", type: "SALE", propertyId: createdProps[4].id, contactId: createdContacts[1].id, ownerId: mike.id, expectedCloseDate: daysAhead(60), notes: "Offer 3% below asking, seller reviewing.", createdAt: daysAgo(6) },
    { title: "Riverside Duplex — Sale", value: 705000, commission: 21150, stage: "OFFER_MADE", type: "SALE", propertyId: createdProps[11].id, contactId: createdContacts[7].id, leadId: createdLeads[6].id, ownerId: sara.id, expectedCloseDate: daysAhead(50), notes: "First offer in, negotiation ongoing.", createdAt: daysAgo(4) },
  ];
  const createdDeals = await Promise.all(
    dealData.map((d) => db.deal.create({ data: d }))
  );

  const taskData = [
    { title: "Call Michael Brown about Marina View Apartment", type: "CALL", priority: "HIGH", status: "PENDING", dueDate: daysAhead(1), assignedToId: sara.id, relatedType: "LEAD", relatedId: createdLeads[0].id, description: "Follow up on website inquiry, send floor plans." },
    { title: "Schedule viewing — Jennifer Davis (Downtown Loft)", type: "VIEWING", priority: "MEDIUM", status: "PENDING", dueDate: daysAhead(2), assignedToId: mike.id, relatedType: "LEAD", relatedId: createdLeads[1].id },
    { title: "Send contract addendum to Palm Grove buyer", type: "PAPERWORK", priority: "URGENT", status: "IN_PROGRESS", dueDate: daysAgo(1), assignedToId: sara.id, relatedType: "DEAL", relatedId: createdDeals[4].id, description: "Inspection clause amendment." },
    { title: "Follow up with Amanda White on commercial offer", type: "FOLLOW_UP", priority: "MEDIUM", status: "PENDING", dueDate: daysAgo(2), assignedToId: mike.id, relatedType: "LEAD", relatedId: createdLeads[3].id },
    { title: "Confirm closing appointment with title company", type: "MEETING", priority: "HIGH", status: "PENDING", dueDate: daysAhead(3), assignedToId: mike.id, relatedType: "DEAL", relatedId: createdDeals[3].id },
    { title: "Update listing photos for Hilltop Plot", type: "OTHER", priority: "LOW", status: "PENDING", dueDate: daysAhead(5), assignedToId: mike.id, relatedType: "PROPERTY", relatedId: createdProps[9].id },
    { title: "Quarterly portfolio review with Nina Patel", type: "MEETING", priority: "MEDIUM", status: "PENDING", dueDate: daysAhead(7), assignedToId: sara.id, relatedType: "CONTACT", relatedId: createdContacts[7].id },
    { title: "Collect signed lease from Oakwood tenant", type: "PAPERWORK", priority: "MEDIUM", status: "COMPLETED", dueDate: daysAgo(5), assignedToId: mike.id, relatedType: "PROPERTY", relatedId: createdProps[8].id },
    { title: "Prepare Sunset Ridge comparables report", type: "OTHER", priority: "HIGH", status: "COMPLETED", dueDate: daysAgo(8), assignedToId: sara.id, relatedType: "DEAL", relatedId: createdDeals[5].id },
    { title: "Welcome call with new landlord David Thompson", type: "CALL", priority: "LOW", status: "COMPLETED", dueDate: daysAgo(12), assignedToId: mike.id, relatedType: "CONTACT", relatedId: createdContacts[2].id },
  ];
  await Promise.all(taskData.map((t) => db.task.create({ data: t })));

  const activityData = [
    { type: "SYSTEM", content: "Property listed on market", entityType: "PROPERTY", entityId: createdProps[0].id, propertyId: createdProps[0].id, userId: sara.id, createdAt: daysAgo(160) },
    { type: "NOTE", content: "Open house had 14 groups through. Two second viewings booked.", entityType: "PROPERTY", entityId: createdProps[2].id, propertyId: createdProps[2].id, userId: sara.id, createdAt: daysAgo(15) },
    { type: "CALL", content: "Buyer confirmed pre-approval letter received from bank.", entityType: "LEAD", entityId: createdLeads[7].id, leadId: createdLeads[7].id, userId: sara.id, createdAt: daysAgo(8) },
    { type: "STATUS_CHANGE", content: "Lead moved to NEGOTIATION after counter-offer accepted in principle.", entityType: "LEAD", entityId: createdLeads[7].id, leadId: createdLeads[7].id, userId: sara.id, createdAt: daysAgo(6) },
    { type: "MEETING", content: "Structural survey booked for Friday. Buyer's solicitor to attend.", entityType: "DEAL", entityId: createdDeals[5].id, dealId: createdDeals[5].id, userId: sara.id, createdAt: daysAgo(4) },
    { type: "NOTE", content: "Bank valuation came in at full asking price. Clear to proceed to contracts.", entityType: "DEAL", entityId: createdDeals[3].id, dealId: createdDeals[3].id, userId: mike.id, createdAt: daysAgo(3) },
    { type: "EMAIL", content: "Sent floor plans and HOA documents to the buyer.", entityType: "LEAD", entityId: createdLeads[0].id, leadId: createdLeads[0].id, userId: sara.id, createdAt: daysAgo(2) },
    { type: "VIEWING", content: "Second viewing completed — very interested, asked for strata fees breakdown.", entityType: "PROPERTY", entityId: createdProps[11].id, propertyId: createdProps[11].id, userId: sara.id, createdAt: daysAgo(1) },
  ];
  await Promise.all(activityData.map((a) => db.activity.create({ data: a })));

  await db.chatMessage.create({
    data: {
      sessionId: "widget",
      role: "assistant",
      content: "Hi! I'm Aria, your Property CRM assistant. Ask me about your listings, leads, deals or tasks — or tell me to create a task, update a lead, or search properties under a budget.",
    },
  });

  // Sync ref counters so the next creates continue after the seeded refs (SRS §6)
  await db.counter.upsert({
    where: { id: `CNT-${year}` },
    create: { id: `CNT-${year}`, seq: createdContacts.length },
    update: { seq: createdContacts.length },
  });
  await db.counter.upsert({
    where: { id: `PRP-${year}` },
    create: { id: `PRP-${year}`, seq: createdProps.length },
    update: { seq: createdProps.length },
  });

  console.log("Seed complete:");
  console.log(`  users: 3 (admin@crm.local / admin123)`);
  console.log(`  properties: ${createdProps.length}, contacts: ${createdContacts.length}, leads: ${createdLeads.length}, deals: ${createdDeals.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
