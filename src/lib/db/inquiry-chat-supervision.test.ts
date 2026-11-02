import test from "node:test";
import assert from "node:assert/strict";
import { dbStore } from "./store";

test("Inquiry Private Chat with Admin Supervision & Meet Ghamr Taxonomy", async (t) => {
  await t.test("1. Creating an inquiry auto-seeds the private chat with buyer message", () => {
    const inquiry = dbStore.createInquiry({
      propertyId: "prop-mg-001",
      propertyTitle: "شقة ميت غمر المطلة على النيل",
      seekerId: "usr-seeker-01",
      seekerName: "أحمد عبد الرحمن",
      seekerPhone: "01012345678",
      seekerEmail: "ahmed@example.com",
      advertiserId: "usr-broker-01",
      message: "أرغب في تحديد موعد لمعاينة الشقة غداً عصراً",
      preferredContact: "call",
    });

    assert.ok(inquiry.id, "Inquiry ID must exist");
    assert.equal(inquiry.status, "new");
    assert.ok(inquiry.messages, "Messages array must exist");
    assert.equal(inquiry.messages.length, 1);
    assert.equal(inquiry.messages[0].content, "أرغب في تحديد موعد لمعاينة الشقة غداً عصراً");
    assert.equal(inquiry.messages[0].senderRole, "buyer");
    assert.equal(inquiry.messages[0].senderName, "أحمد عبد الرحمن");
  });

  await t.test("2. Advertiser (owner/broker) replies in the private chat", () => {
    const inquiries = dbStore.getAllInquiriesForAdmin();
    const targetInq = inquiries[0];
    assert.ok(targetInq);

    const reply = dbStore.addInquiryMessage(targetInq.id, {
      senderId: "usr-broker-01",
      senderName: "المكتب العقاري المعتمد",
      senderRole: "broker",
      content: "أهلاً بك يا فندم، الموعد مناسب جداً في تمام الساعة 4 عصراً بمقر العقار",
    });

    assert.ok(reply);
    assert.equal(reply.senderRole, "broker");

    const history = dbStore.getInquiryMessages(targetInq.id);
    assert.equal(history.length, 2);
    assert.equal(history[1].content, "أهلاً بك يا فندم، الموعد مناسب جداً في تمام الساعة 4 عصراً بمقر العقار");
  });

  await t.test("3. Platform Administration inspects and sends supervisory guidance note", () => {
    const inquiries = dbStore.getAllInquiriesForAdmin();
    const targetInq = inquiries[0];
    assert.ok(targetInq);

    const adminNote = dbStore.addInquiryMessage(targetInq.id, {
      senderId: "admin-platform-01",
      senderName: "إدارة منصة دار العقار",
      senderRole: "admin",
      content: "تنبيه إداري: حرصاً على سلامتكم وأمان المعاملة، يرجى فحص سندات الملكية الرسمية قبل دفع أي مبالغ مالية.",
      isAdminNote: true,
    });

    assert.ok(adminNote);
    assert.equal(adminNote.senderRole, "admin");
    assert.equal(adminNote.isAdminNote, true);

    const fullHistory = dbStore.getInquiryMessages(targetInq.id);
    assert.equal(fullHistory.length, 3);
    assert.equal(fullHistory[2].isAdminNote, true);
  });

  await t.test("4. Taxonomy contains Meet Ghamr center and comprehensive villages", () => {
    const districts = dbStore.getDistricts();
    const meetGhamrDistricts = districts.filter(
      (d) => d.cityId === "city-dakahlia" || d.id.startsWith("dist-meet-")
    );

    assert.ok(meetGhamrDistricts.length >= 40, "Meet Ghamr must include 40+ villages and districts");
    const cityDistrict = meetGhamrDistricts.find((d) => d.id === "dist-meet-ghamr-city");
    assert.ok(cityDistrict, "Meet Ghamr central city must be present");
    assert.equal(cityDistrict.nameAr, "مدينة ميت غمر (المركز)");

    const daqados = meetGhamrDistricts.find((d) => d.id === "dist-daqados");
    assert.ok(daqados, "Daqados village must be present");
    assert.equal(daqados.nameAr, "دقادوس");

    const tafahna = meetGhamrDistricts.find((d) => d.id === "dist-tafahna-al-ashraf");
    assert.ok(tafahna, "Tafahna Al-Ashraf village must be present");
    assert.equal(tafahna.nameAr, "تفهنا الأشراف");
  });

  await t.test("5. Buyer sends viewing proposal and price offer, Owner updates status", () => {
    const inquiries = dbStore.getAllInquiriesForAdmin();
    const targetInq = inquiries[0];
    assert.ok(targetInq);

    // 1. Buyer sends viewing proposal
    const viewingMsg = dbStore.addInquiryMessage(targetInq.id, {
      senderId: "usr-seeker-01",
      senderName: "أحمد عبد الرحمن",
      senderRole: "buyer",
      content: "📅 طلب موعد معاينة ميدانية:\nأقترح زيارة ومعاينة العقار غداً عصراً (4:00 - 6:00 مساءً).",
    });
    assert.ok(viewingMsg);

    // 2. Owner confirms and updates status to viewing_scheduled
    const updatedInq = dbStore.updateInquiryStatus(targetInq.id, "viewing_scheduled", "usr-broker-01", "broker");
    assert.equal(updatedInq.status, "viewing_scheduled");

    // 3. Buyer sends price offer
    const offerMsg = dbStore.addInquiryMessage(targetInq.id, {
      senderId: "usr-seeker-01",
      senderName: "أحمد عبد الرحمن",
      senderRole: "buyer",
      content: "💰 تقديم سومة / عرض سعر:\nأود تقديم عرض سعر جاد بقيمة 1,200,000 ج.م.",
    });
    assert.ok(offerMsg);

    // 4. Owner transitions to negotiating, then deal_closed
    dbStore.updateInquiryStatus(targetInq.id, "negotiating", "usr-broker-01", "broker");
    assert.equal(dbStore.getInquiryById(targetInq.id)?.status, "negotiating");

    dbStore.updateInquiryStatus(targetInq.id, "deal_closed", "usr-broker-01", "broker");
    assert.equal(dbStore.getInquiryById(targetInq.id)?.status, "deal_closed");
  });

  await t.test("6. Message deduplication prevents accidental double-submission and supports confidential internal notes", () => {
    const inq = dbStore.createInquiry({
      propertyId: "prop-mg-001",
      propertyTitle: "شقة ميت غمر المطلة على النيل",
      seekerId: "usr-seeker-dedup",
      seekerName: "كريم محمود",
      seekerPhone: "01099887766",
      seekerEmail: "karim@example.com",
      advertiserId: "usr-broker-01",
      message: "هل العقار قابل للتمويل العقاري؟",
      preferredContact: "in_app",
    });

    // Rapid duplicate message within 10s should return the existing message without duplicating
    const msg1 = dbStore.addInquiryMessage(inq.id, {
      senderId: "usr-broker-01",
      senderName: "المكتب العقاري المعتمد",
      senderRole: "broker",
      content: "نعم العقار مسجل شهر عقاري وقابل للتمويل",
    });
    const msg2 = dbStore.addInquiryMessage(inq.id, {
      senderId: "usr-broker-01",
      senderName: "المكتب العقاري المعتمد",
      senderRole: "broker",
      content: "نعم العقار مسجل شهر عقاري وقابل للتمويل",
    });
    assert.equal(msg1.id, msg2.id, "Duplicate rapid message must be deduplicated");

    // Add confidential internal admin note
    const internalNote = dbStore.addInquiryMessage(inq.id, {
      senderId: "admin-platform-01",
      senderName: "إدارة المنصة",
      senderRole: "admin",
      content: "ملاحظة رقابية داخلية: تم التحقق من رخصة الوسيط",
      isAdminNote: true,
      isInternalNote: true,
    });
    assert.equal(internalNote.isInternalNote, true);

    // Unread count for seeker should only count non-internal messages from advertiser
    const unreadForSeeker = dbStore.getInquiryUnreadCount(inq.id, "usr-seeker-dedup");
    assert.equal(unreadForSeeker, 1, "Internal admin note must not inflate participant unread count");
  });

  await t.test("7. Buyer and advertiser complete a persistent two-way conversation with read receipts", () => {
    const suffix = Date.now().toString(36);
    const inquiry = dbStore.createInquiry({
      propertyId: "prop-mg-001",
      propertyTitle: "شقة ميت غمر المطلة على النيل",
      seekerId: `buyer-${suffix}`,
      seekerName: "مشتري الاختبار",
      seekerPhone: `010${suffix.slice(-8)}`,
      seekerEmail: `buyer-${suffix}@example.com`,
      advertiserId: `owner-${suffix}`,
      message: "هل العقار متاح للمعاينة؟",
      preferredContact: "in_app",
    });

    assert.equal(dbStore.getInquiryUnreadCount(inquiry.id, `owner-${suffix}`), 1);
    dbStore.markInquiryMessagesAsRead(inquiry.id, `owner-${suffix}`);
    assert.equal(dbStore.getInquiryUnreadCount(inquiry.id, `owner-${suffix}`), 0);

    const ownerReply = dbStore.addInquiryMessage(inquiry.id, {
      senderId: `owner-${suffix}`,
      senderName: "عارض المشروع",
      senderRole: "owner",
      content: "نعم، المعاينة متاحة غداً الساعة الخامسة.",
    });
    assert.equal(dbStore.getInquiryUnreadCount(inquiry.id, `buyer-${suffix}`), 1);

    dbStore.markInquiryMessagesAsRead(inquiry.id, `buyer-${suffix}`);
    assert.equal(dbStore.getInquiryUnreadCount(inquiry.id, `buyer-${suffix}`), 0);

    const buyerReply = dbStore.addInquiryMessage(inquiry.id, {
      senderId: `buyer-${suffix}`,
      senderName: "مشتري الاختبار",
      senderRole: "buyer",
      content: "مناسب، سأكون في الموقع في الموعد.",
    });
    assert.equal(dbStore.getInquiryUnreadCount(inquiry.id, `owner-${suffix}`), 1);

    const finalOwnerReply = dbStore.addInquiryMessage(inquiry.id, {
      senderId: `owner-${suffix}`,
      senderName: "عارض المشروع",
      senderRole: "owner",
      content: "تم، سأرسل لك موقع التجمع قبل الموعد.",
    });
    dbStore.markInquiryMessagesAsRead(inquiry.id, `owner-${suffix}`);

    const savedMessages = dbStore.getInquiryMessages(inquiry.id);
    assert.equal(dbStore.getInquiryUnreadCount(inquiry.id, `owner-${suffix}`), 0);
    assert.equal(dbStore.getInquiryUnreadCount(inquiry.id, `buyer-${suffix}`), 1);
    assert.equal(savedMessages.length, 4);
    assert.equal(savedMessages[1].id, ownerReply.id);
    assert.equal(savedMessages[2].id, buyerReply.id);
    assert.equal(savedMessages[3].id, finalOwnerReply.id);
    assert.ok(savedMessages.slice(0, 3).every((message) => message.isRead));
    assert.equal(savedMessages[3].isRead, false);

    dbStore.reloadFromDisk();
    assert.equal(dbStore.getInquiryMessages(inquiry.id).length, 4);
  });

  await t.test("8. Real-time Admin Analytics accurately computes response rate, conversions, and report metrics", () => {
    const stats = dbStore.getAdminStats();
    assert.ok(stats.totalUsers > 0);
    assert.ok(stats.totalInquiries >= 2);
    assert.ok(stats.totalMessagesCount >= 5);
    assert.ok(stats.responseRatePercent >= 0 && stats.responseRatePercent <= 100);
    assert.ok(stats.dealClosedCount >= 1);
    assert.ok(stats.viewingConversionPercent >= 0 && stats.viewingConversionPercent <= 100);
    assert.ok(stats.dealConversionPercent >= 0 && stats.dealConversionPercent <= 100);
  });
});
