"use client";

/**
 * Thai / English UI strings and the language switch.
 *
 * The chosen language is a per-browser preference kept in localStorage. It is
 * read through `useSyncExternalStore` with a server snapshot of "th", so the
 * server render and hydration agree and the stored choice applies right after.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import type { ReactNode } from "react";

import { ApiError } from "./api";

export type Locale = "th" | "en";

const STORAGE_KEY = "splitbill.locale";
const DEFAULT_LOCALE: Locale = "th";

const en = {
  "app.name": "SplitBill",
  "app.tagline": "Shared bills with friends, split to the satang.",
  "lang.label": "Language",
  "lang.th": "ไทย",
  "lang.en": "EN",
  "common.you": "you",
  "common.loading": "Loading…",
  "common.dismiss": "Dismiss",
  "common.retry": "Try again",

  "auth.username": "Username",
  "auth.password": "Password",
  "auth.confirmPassword": "Confirm password",
  "auth.showPassword": "Show password",
  "auth.hidePassword": "Hide password",
  "auth.usernameHint": "3–32 characters: a–z, 0–9, dot, dash or underscore.",
  "auth.passwordHint": "At least 8 characters.",
  "auth.usernameRequired": "Enter your username.",
  "auth.usernameInvalid": "Use 3–32 lowercase letters, numbers, dots, dashes or underscores.",
  "auth.passwordRequired": "Enter your password.",
  "auth.passwordShort": "Use at least 8 characters.",
  "auth.passwordMismatch": "The passwords don’t match.",
  "login.title": "Sign in",
  "login.subtitle": "Welcome back. Your groups’ balances are waiting.",
  "login.submit": "Sign in",
  "login.submitting": "Signing in…",
  "login.noAccount": "New to SplitBill?",
  "login.toRegister": "Create an account",
  "register.title": "Create your account",
  "register.subtitle": "One account for every group you share bills with.",
  "register.submit": "Create account",
  "register.submitting": "Creating account…",
  "register.haveAccount": "Already have an account?",
  "register.toLogin": "Sign in",
  "auth.showcaseCaption": "Electricity, October · 1,000.00 split three ways",
  "auth.showcaseNote": "The leftover satang goes to the first member, so every bill adds up exactly.",
  "auth.checking": "Checking your session…",

  "rail.households": "Groups",
  "rail.signedInAs": "Signed in as",
  "rail.signOut": "Sign out",
  "rail.signingOut": "Signing out…",
  "home.noHouseholdsTitle": "You’re not in a group yet",
  "home.noHouseholdsBody":
    "Create a group, or open an invite link from a friend to join theirs.",
  "home.pickHousehold": "Choose a group to see its bills.",
  "household.roommates": "{n} members",
  "household.roommatesOne": "1 member",
  "household.bills": "{n} bills",
  "household.billsOne": "1 bill",

  "balance.title": "Balances",
  "balance.youOwed": "You’re owed",
  "balance.youOwe": "You owe",
  "balance.settled": "You’re all settled up",
  "balance.scope": "Across every bill in this group, in THB.",
  "balance.isOwed": "is owed",
  "balance.owes": "owes",
  "balance.settledShort": "settled",
  "balance.empty": "No balances yet.",

  "bills.title": "Bills",
  "bills.colBill": "Bill",
  "bills.colPaidBy": "Paid by",
  "bills.colSplit": "Split",
  "bills.colDate": "Date",
  "bills.colAmount": "THB",
  "bills.empty": "No bills yet. Add the first one with the form.",
  "bills.delete": "Delete",
  "bills.deleteLabel": "Delete {bill}",
  "bills.confirm": "Delete this bill?",
  "bills.confirmYes": "Delete",
  "bills.confirmNo": "Keep",
  "bills.deleting": "Deleting…",
  "split.equal": "Equal · {n}",
  "split.exact": "Exact · {n}",
  "split.unknown": "Split",

  "form.title": "New bill",
  "form.description": "What was it for?",
  "form.descriptionPlaceholder": "Electricity October",
  "form.amount": "Amount (THB)",
  "form.paidBy": "Paid by",
  "form.selectMember": "Choose who paid…",
  "form.splitType": "How to split",
  "form.equal": "Equally",
  "form.exact": "Exact amounts",
  "form.splitBetween": "Split between",
  "form.selectAll": "Everyone",
  "form.clear": "Nobody",
  "form.shareFor": "Share for {member}",
  "form.previewEmpty": "Enter an amount to see each share.",
  "form.remaining": "{amount} still to assign",
  "form.over": "{amount} over the total",
  "form.balanced": "Shares add up to the total.",
  "form.notIncluded": "not included",
  "form.paid": "paid",
  "form.total": "Total",
  "form.submit": "Save bill",
  "form.submitting": "Saving…",
  "form.needDescription": "Add what the bill was for.",
  "form.needAmount": "Enter an amount above 0 with up to 2 decimals.",
  "form.needPayer": "Choose who paid.",
  "form.needMember": "Pick at least one member.",
  "form.fixShares": "Fix the highlighted shares.",
  "form.sharesMustAdd": "The shares must add up to the total.",
  "form.carrierLabel": "Split preview: {summary}",

  "amount.empty": "Enter an amount.",
  "amount.decimals": "THB amounts use at most 2 decimal places.",
  "amount.invalid": "Enter an amount like 250 or 250.50.",
  "amount.tooLarge": "That amount is too large.",

  "notice.saved": "Bill saved.",
  "notice.deleted": "Bill deleted.",

  "error.network": "Can’t reach the server. Check that the backend is running, then try again.",
  "error.400": "That was rejected. Please check the amounts and try again.",
  "error.401": "Your session has ended. Please sign in again.",
  "error.403": "You’re not allowed to do that.",
  "error.404": "That wasn’t found. It may have been deleted.",
  "error.409": "That conflicts with an earlier request. Please try again.",
  "error.422": "Some values weren’t valid. Please check them.",
  "error.5xx": "The server is having trouble. Please try again shortly.",
  "error.generic": "Something went wrong. Please try again.",
  "rail.newHousehold": "New group",
  "household.settings": "Settings",
  "household.invite": "Invite",
  "household.backToBills": "Back to bills",
  "create.title": "New group",
  "create.body": "You'll be its owner. Invite your friends with a link once it's created.",
  "create.name": "Group name",
  "create.namePlaceholder": "Chiang Mai trip",
  "create.submit": "Create group",
  "create.submitting": "Creating…",
  "create.cancel": "Cancel",
  "create.nameRequired": "Give the group a name.",
  "settings.title": "Group settings",
  "settings.name": "Name",
  "settings.saveName": "Save name",
  "settings.saving": "Saving…",
  "settings.ownerOnlyName": "Only {owner} (the owner) can rename this group.",
  "settings.inviteTitle": "Invite friends",
  "settings.inviteBody": "Anyone signed in who opens this link joins the group.",
  "settings.copy": "Copy link",
  "settings.copied": "Copied",
  "settings.resetInvite": "Reset link",
  "settings.resetInviteBody": "The old link stops working.",
  "settings.membersTitle": "Members",
  "settings.owner": "owner",
  "settings.remove": "Remove",
  "settings.removeConfirm": "Remove {member}?",
  "settings.leave": "Leave group",
  "settings.leaveConfirm": "Leave {group}? You'll need a new invite to come back.",
  "settings.confirmYes": "Yes",
  "settings.confirmNo": "Cancel",
  "settings.settledRule": "Only members with a 0.00 balance can leave or be removed, so the ledger always adds up.",
  "settings.dangerTitle": "Delete group",
  "settings.dangerBody": "Deletes the group and all of its bills for everyone. This can't be undone.",
  "settings.dangerConfirmLabel": "Type “{group}” to confirm",
  "settings.delete": "Delete group",
  "settings.deleting": "Deleting…",
  "notice.created": "Group created. Share the invite link with your friends.",
  "notice.renamed": "Name saved.",
  "notice.inviteReset": "New invite link ready. The old one no longer works.",
  "notice.memberRemoved": "{member} was removed.",
  "notice.left": "You left {group}.",
  "notice.groupDeleted": "{group} was deleted.",
  "notice.joined": "You joined {group}.",
  "notice.updated": "Bill updated.",
  "bills.edit": "Edit",
  "bills.editLabel": "Edit {bill}",
  "form.editTitle": "Edit bill",
  "form.saveChanges": "Save changes",
  "form.cancelEdit": "Cancel",
  "join.title": "Join {group}",
  "join.body": "{owner} invited you. Members so far: {n}.",
  "join.alreadyMember": "You're already in {group}.",
  "join.submit": "Join group",
  "join.submitting": "Joining…",
  "join.open": "Open group",
  "join.signInFirst": "Sign in or create an account to join.",
  "join.invalid": "This invite link is not valid. Ask for a new one.",
  "join.toHome": "Go to my groups",
};

export type MessageKey = keyof typeof en;

const th: Record<MessageKey, string> = {
  "app.name": "SplitBill",
  "app.tagline": "หารค่าใช้จ่ายกับเพื่อน แม่นยำทุกสตางค์",
  "lang.label": "ภาษา",
  "lang.th": "ไทย",
  "lang.en": "EN",
  "common.you": "คุณ",
  "common.loading": "กำลังโหลด…",
  "common.dismiss": "ปิด",
  "common.retry": "ลองอีกครั้ง",

  "auth.username": "ชื่อผู้ใช้",
  "auth.password": "รหัสผ่าน",
  "auth.confirmPassword": "ยืนยันรหัสผ่าน",
  "auth.showPassword": "แสดงรหัสผ่าน",
  "auth.hidePassword": "ซ่อนรหัสผ่าน",
  "auth.usernameHint": "3–32 ตัวอักษร: a–z, 0–9, จุด, ขีด หรือขีดล่าง",
  "auth.passwordHint": "อย่างน้อย 8 ตัวอักษร",
  "auth.usernameRequired": "กรอกชื่อผู้ใช้",
  "auth.usernameInvalid": "ใช้ตัวพิมพ์เล็ก ตัวเลข จุด ขีด หรือขีดล่าง 3–32 ตัว",
  "auth.passwordRequired": "กรอกรหัสผ่าน",
  "auth.passwordShort": "ใช้อย่างน้อย 8 ตัวอักษร",
  "auth.passwordMismatch": "รหัสผ่านทั้งสองช่องไม่ตรงกัน",
  "login.title": "เข้าสู่ระบบ",
  "login.subtitle": "ยินดีต้อนรับกลับ ยอดของกลุ่มคุณรออยู่แล้ว",
  "login.submit": "เข้าสู่ระบบ",
  "login.submitting": "กำลังเข้าสู่ระบบ…",
  "login.noAccount": "ยังไม่มีบัญชี?",
  "login.toRegister": "สร้างบัญชี",
  "register.title": "สร้างบัญชีของคุณ",
  "register.subtitle": "บัญชีเดียว ใช้ได้กับทุกกลุ่มที่คุณหารค่าใช้จ่ายด้วย",
  "register.submit": "สร้างบัญชี",
  "register.submitting": "กำลังสร้างบัญชี…",
  "register.haveAccount": "มีบัญชีอยู่แล้ว?",
  "register.toLogin": "เข้าสู่ระบบ",
  "auth.showcaseCaption": "ค่าไฟ ตุลาคม · 1,000.00 หารสามคน",
  "auth.showcaseNote": "เศษสตางค์ที่เหลือไปที่สมาชิกคนแรก ทุกบิลจึงรวมได้ตรงพอดี",
  "auth.checking": "กำลังตรวจสอบการเข้าสู่ระบบ…",

  "rail.households": "กลุ่มของฉัน",
  "rail.signedInAs": "เข้าสู่ระบบในชื่อ",
  "rail.signOut": "ออกจากระบบ",
  "rail.signingOut": "กำลังออกจากระบบ…",
  "home.noHouseholdsTitle": "คุณยังไม่ได้อยู่ในกลุ่มไหน",
  "home.noHouseholdsBody": "สร้างกลุ่มใหม่ หรือเปิดลิงก์ชวนจากเพื่อนเพื่อเข้าร่วมกลุ่ม",
  "home.pickHousehold": "เลือกกลุ่มเพื่อดูรายการบิล",
  "household.roommates": "สมาชิก {n} คน",
  "household.roommatesOne": "สมาชิก 1 คน",
  "household.bills": "{n} รายการ",
  "household.billsOne": "1 รายการ",

  "balance.title": "ยอดคงเหลือ",
  "balance.youOwed": "คุณจะได้รับคืน",
  "balance.youOwe": "คุณต้องจ่าย",
  "balance.settled": "คุณเคลียร์ยอดครบแล้ว",
  "balance.scope": "รวมทุกบิลในกลุ่มนี้ หน่วยเป็นบาท",
  "balance.isOwed": "ได้รับคืน",
  "balance.owes": "ต้องจ่าย",
  "balance.settledShort": "เคลียร์แล้ว",
  "balance.empty": "ยังไม่มียอด",

  "bills.title": "รายการบิล",
  "bills.colBill": "รายการ",
  "bills.colPaidBy": "คนจ่าย",
  "bills.colSplit": "วิธีแบ่ง",
  "bills.colDate": "วันที่",
  "bills.colAmount": "บาท",
  "bills.empty": "ยังไม่มีบิล เพิ่มบิลแรกได้จากฟอร์ม",
  "bills.delete": "ลบ",
  "bills.deleteLabel": "ลบ {bill}",
  "bills.confirm": "ลบบิลนี้?",
  "bills.confirmYes": "ลบ",
  "bills.confirmNo": "เก็บไว้",
  "bills.deleting": "กำลังลบ…",
  "split.equal": "เท่ากัน · {n} คน",
  "split.exact": "ระบุเอง · {n} คน",
  "split.unknown": "แบ่ง",

  "form.title": "บิลใหม่",
  "form.description": "ค่าอะไร",
  "form.descriptionPlaceholder": "ค่าไฟ ตุลาคม",
  "form.amount": "จำนวนเงิน (บาท)",
  "form.paidBy": "คนจ่าย",
  "form.selectMember": "เลือกคนที่จ่าย…",
  "form.splitType": "วิธีแบ่ง",
  "form.equal": "หารเท่ากัน",
  "form.exact": "ระบุจำนวนเอง",
  "form.splitBetween": "หารกับ",
  "form.selectAll": "ทุกคน",
  "form.clear": "ไม่เลือก",
  "form.shareFor": "ส่วนของ {member}",
  "form.previewEmpty": "กรอกจำนวนเงินเพื่อดูส่วนของแต่ละคน",
  "form.remaining": "ยังเหลือ {amount} ที่ยังไม่ได้แบ่ง",
  "form.over": "เกินยอดรวม {amount}",
  "form.balanced": "รวมได้ตรงกับยอดทั้งหมดแล้ว",
  "form.notIncluded": "ไม่ได้หาร",
  "form.paid": "จ่าย",
  "form.total": "รวม",
  "form.submit": "บันทึกบิล",
  "form.submitting": "กำลังบันทึก…",
  "form.needDescription": "ระบุว่าเป็นค่าอะไร",
  "form.needAmount": "กรอกจำนวนเงินมากกว่า 0 ทศนิยมไม่เกิน 2 ตำแหน่ง",
  "form.needPayer": "เลือกคนที่จ่าย",
  "form.needMember": "เลือกสมาชิกอย่างน้อย 1 คน",
  "form.fixShares": "แก้ไขช่องที่ไฮไลต์ไว้",
  "form.sharesMustAdd": "ส่วนของทุกคนต้องรวมได้เท่ากับยอดทั้งหมด",
  "form.carrierLabel": "ตัวอย่างการแบ่ง: {summary}",

  "amount.empty": "กรอกจำนวนเงิน",
  "amount.decimals": "จำนวนเงินบาทมีทศนิยมได้ไม่เกิน 2 ตำแหน่ง",
  "amount.invalid": "กรอกจำนวนเงิน เช่น 250 หรือ 250.50",
  "amount.tooLarge": "จำนวนเงินมากเกินไป",

  "notice.saved": "บันทึกบิลแล้ว",
  "notice.deleted": "ลบบิลแล้ว",

  "error.network": "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสอบว่าแบ็กเอนด์ทำงานอยู่ แล้วลองอีกครั้ง",
  "error.400": "คำขอถูกปฏิเสธ ตรวจสอบจำนวนเงินแล้วลองอีกครั้ง",
  "error.401": "เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง",
  "error.403": "คุณไม่มีสิทธิ์ทำรายการนี้",
  "error.404": "ไม่พบข้อมูล อาจถูกลบไปแล้ว",
  "error.409": "รายการนี้ขัดแย้งกับคำขอก่อนหน้า กรุณาลองอีกครั้ง",
  "error.422": "ข้อมูลบางช่องไม่ถูกต้อง กรุณาตรวจสอบ",
  "error.5xx": "เซิร์ฟเวอร์มีปัญหา กรุณาลองใหม่ในอีกสักครู่",
  "error.generic": "เกิดข้อผิดพลาด กรุณาลองอีกครั้ง",
  "rail.newHousehold": "สร้างกลุ่มใหม่",
  "household.settings": "ตั้งค่า",
  "household.invite": "ชวนเพื่อน",
  "household.backToBills": "กลับไปที่รายการบิล",
  "create.title": "สร้างกลุ่มใหม่",
  "create.body": "คุณจะเป็นเจ้าของกลุ่ม สร้างเสร็จแล้วส่งลิงก์ชวนเพื่อนได้เลย",
  "create.name": "ชื่อกลุ่ม",
  "create.namePlaceholder": "ทริปเชียงใหม่",
  "create.submit": "สร้างกลุ่ม",
  "create.submitting": "กำลังสร้าง…",
  "create.cancel": "ยกเลิก",
  "create.nameRequired": "ตั้งชื่อกลุ่มก่อน",
  "settings.title": "ตั้งค่ากลุ่ม",
  "settings.name": "ชื่อ",
  "settings.saveName": "บันทึกชื่อ",
  "settings.saving": "กำลังบันทึก…",
  "settings.ownerOnlyName": "เฉพาะ {owner} (เจ้าของ) เท่านั้นที่เปลี่ยนชื่อกลุ่มได้",
  "settings.inviteTitle": "ชวนเพื่อน",
  "settings.inviteBody": "ใครก็ตามที่เข้าสู่ระบบแล้วเปิดลิงก์นี้ จะเข้าร่วมกลุ่มทันที",
  "settings.copy": "คัดลอกลิงก์",
  "settings.copied": "คัดลอกแล้ว",
  "settings.resetInvite": "สร้างลิงก์ใหม่",
  "settings.resetInviteBody": "ลิงก์เดิมจะใช้ไม่ได้อีก",
  "settings.membersTitle": "สมาชิก",
  "settings.owner": "เจ้าของ",
  "settings.remove": "นำออก",
  "settings.removeConfirm": "นำ {member} ออก?",
  "settings.leave": "ออกจากกลุ่ม",
  "settings.leaveConfirm": "ออกจาก {group}? ต้องได้ลิงก์ชวนใหม่ถึงจะกลับมาได้",
  "settings.confirmYes": "ใช่",
  "settings.confirmNo": "ยกเลิก",
  "settings.settledRule": "เฉพาะสมาชิกที่ยอดเป็น 0.00 เท่านั้นที่ออกหรือถูกนำออกได้ เพื่อให้ยอดรวมถูกต้องเสมอ",
  "settings.dangerTitle": "ลบกลุ่ม",
  "settings.dangerBody": "ลบกลุ่มและบิลทั้งหมดสำหรับทุกคน ย้อนกลับไม่ได้",
  "settings.dangerConfirmLabel": "พิมพ์ “{group}” เพื่อยืนยัน",
  "settings.delete": "ลบกลุ่ม",
  "settings.deleting": "กำลังลบ…",
  "notice.created": "สร้างกลุ่มแล้ว ส่งลิงก์ชวนให้เพื่อนได้เลย",
  "notice.renamed": "บันทึกชื่อแล้ว",
  "notice.inviteReset": "สร้างลิงก์ชวนใหม่แล้ว ลิงก์เดิมใช้ไม่ได้อีก",
  "notice.memberRemoved": "นำ {member} ออกแล้ว",
  "notice.left": "คุณออกจาก {group} แล้ว",
  "notice.groupDeleted": "ลบ {group} แล้ว",
  "notice.joined": "คุณเข้าร่วม {group} แล้ว",
  "notice.updated": "แก้ไขบิลแล้ว",
  "bills.edit": "แก้ไข",
  "bills.editLabel": "แก้ไข {bill}",
  "form.editTitle": "แก้ไขบิล",
  "form.saveChanges": "บันทึกการแก้ไข",
  "form.cancelEdit": "ยกเลิก",
  "join.title": "เข้าร่วม {group}",
  "join.body": "{owner} ชวนคุณ ตอนนี้กลุ่มนี้มีสมาชิก {n} คน",
  "join.alreadyMember": "คุณอยู่ใน {group} แล้ว",
  "join.submit": "เข้าร่วมกลุ่ม",
  "join.submitting": "กำลังเข้าร่วม…",
  "join.open": "เปิดกลุ่มนี้",
  "join.signInFirst": "เข้าสู่ระบบหรือสร้างบัญชีเพื่อเข้าร่วม",
  "join.invalid": "ลิงก์ชวนนี้ใช้ไม่ได้ ขอลิงก์ใหม่จากเพื่อน",
  "join.toHome": "ไปที่กลุ่มของฉัน",
};

const MESSAGES: Record<Locale, Record<MessageKey, string>> = { en, th };

/** parseAmountCents error strings (lib/money.ts) → translated keys. */
const AMOUNT_ERRORS: Record<string, MessageKey> = {
  "Enter an amount": "amount.empty",
  "THB amounts use at most 2 decimal places": "amount.decimals",
  "Enter a positive amount like 250 or 250.50": "amount.invalid",
  "That amount is too large": "amount.tooLarge",
};

/* ------------------------------------------------------------------ */
/* Locale store                                                        */
/* ------------------------------------------------------------------ */

const listeners = new Set<() => void>();
/** Fallback when localStorage is unavailable (private mode, blocked storage). */
let memoryLocale: Locale | null = null;

function readStoredLocale(): Locale {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "en" || stored === "th" ? stored : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function writeLocale(locale: Locale): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Private mode or blocked storage: the choice still applies for this page.
    memoryLocale = locale;
  }
  listeners.forEach((listener) => listener());
}

function getSnapshot(): Locale {
  return memoryLocale ?? readStoredLocale();
}

/* ------------------------------------------------------------------ */
/* Context                                                             */
/* ------------------------------------------------------------------ */

export type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

interface I18nValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translate;
  /** Intl locale tag for dates, e.g. "th-TH". */
  intlLocale: string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_LOCALE);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const t = useCallback<Translate>(
    (key, vars) => {
      const template = MESSAGES[locale][key];
      if (!vars) return template;
      return template.replace(/\{(\w+)\}/g, (match, name: string) =>
        name in vars ? String(vars[name]) : match,
      );
    },
    [locale],
  );

  const value = useMemo<I18nValue>(
    () => ({ locale, setLocale: writeLocale, t, intlLocale: locale === "th" ? "th-TH" : "en-GB" }),
    [locale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (value === null) throw new Error("useI18n must be used inside <I18nProvider>");
  return value;
}

/** "1 bill" vs "3 bills": picks the singular key when n is 1. */
export function countText(
  t: Translate,
  n: number,
  one: "household.roommatesOne" | "household.billsOne",
  many: "household.roommates" | "household.bills",
): string {
  return n === 1 ? t(one) : t(many, { n });
}

/** Translate a parseAmountCents error; unknown strings pass through. */
export function amountErrorText(error: string, t: Translate): string {
  const key = AMOUNT_ERRORS[error];
  return key ? t(key) : error;
}

/**
 * Plain-language message for anything thrown by a request. Backend `detail`
 * messages are written for people and pass through as sent; otherwise the
 * status picks the wording.
 */
export function errorText(error: unknown, t: Translate): string {
  if (!(error instanceof ApiError)) return t("error.generic");
  if (error.detail) return error.detail;
  if (error.status === 0) return t("error.network");
  if (error.status < 0) return t("error.generic");
  if (error.status >= 500) return t("error.5xx");
  const key = `error.${error.status}` as MessageKey;
  return key in en ? t(key) : t("error.generic");
}
