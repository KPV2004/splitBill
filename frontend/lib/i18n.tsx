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
  "app.tagline": "Shared household bills, split to the satang.",
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
  "login.subtitle": "Welcome back. Your household’s balances are waiting.",
  "login.submit": "Sign in",
  "login.submitting": "Signing in…",
  "login.noAccount": "New to SplitBill?",
  "login.toRegister": "Create an account",
  "register.title": "Create your account",
  "register.subtitle": "One account for every household you share bills with.",
  "register.submit": "Create account",
  "register.submitting": "Creating account…",
  "register.haveAccount": "Already have an account?",
  "register.toLogin": "Sign in",
  "auth.showcaseCaption": "Electricity, October · 1,000.00 split three ways",
  "auth.showcaseNote": "The leftover satang goes to the first roommate, so every bill adds up exactly.",
  "auth.checking": "Checking your session…",

  "rail.households": "Households",
  "rail.signedInAs": "Signed in as",
  "rail.signOut": "Sign out",
  "rail.signingOut": "Signing out…",
  "home.noHouseholdsTitle": "You’re not in a household yet",
  "home.noHouseholdsBody":
    "Households are set up for you for now. Once a roommate adds you, it will appear here.",
  "home.pickHousehold": "Choose a household to see its bills.",
  "household.roommates": "{n} roommates",
  "household.bills": "{n} bills",

  "balance.title": "Balances",
  "balance.youOwed": "You’re owed",
  "balance.youOwe": "You owe",
  "balance.settled": "You’re all settled up",
  "balance.scope": "Across every bill in this household, in THB.",
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
  "form.needMember": "Pick at least one roommate.",
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
};

export type MessageKey = keyof typeof en;

const th: Record<MessageKey, string> = {
  "app.name": "SplitBill",
  "app.tagline": "แบ่งค่าใช้จ่ายในบ้าน แม่นยำทุกสตางค์",
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
  "login.subtitle": "ยินดีต้อนรับกลับ ยอดของบ้านคุณรออยู่แล้ว",
  "login.submit": "เข้าสู่ระบบ",
  "login.submitting": "กำลังเข้าสู่ระบบ…",
  "login.noAccount": "ยังไม่มีบัญชี?",
  "login.toRegister": "สร้างบัญชี",
  "register.title": "สร้างบัญชีของคุณ",
  "register.subtitle": "บัญชีเดียว ใช้ได้กับทุกบ้านที่คุณหารค่าใช้จ่ายด้วย",
  "register.submit": "สร้างบัญชี",
  "register.submitting": "กำลังสร้างบัญชี…",
  "register.haveAccount": "มีบัญชีอยู่แล้ว?",
  "register.toLogin": "เข้าสู่ระบบ",
  "auth.showcaseCaption": "ค่าไฟ ตุลาคม · 1,000.00 หารสามคน",
  "auth.showcaseNote": "เศษสตางค์ที่เหลือไปที่สมาชิกคนแรก ทุกบิลจึงรวมได้ตรงพอดี",
  "auth.checking": "กำลังตรวจสอบการเข้าสู่ระบบ…",

  "rail.households": "บ้านของฉัน",
  "rail.signedInAs": "เข้าสู่ระบบในชื่อ",
  "rail.signOut": "ออกจากระบบ",
  "rail.signingOut": "กำลังออกจากระบบ…",
  "home.noHouseholdsTitle": "คุณยังไม่ได้อยู่ในบ้านไหน",
  "home.noHouseholdsBody": "ตอนนี้บ้านจะถูกตั้งค่าให้คุณ เมื่อเพื่อนร่วมห้องเพิ่มคุณแล้ว บ้านจะแสดงที่นี่",
  "home.pickHousehold": "เลือกบ้านเพื่อดูรายการบิล",
  "household.roommates": "สมาชิก {n} คน",
  "household.bills": "{n} รายการ",

  "balance.title": "ยอดคงเหลือ",
  "balance.youOwed": "คุณจะได้รับคืน",
  "balance.youOwe": "คุณต้องจ่าย",
  "balance.settled": "คุณเคลียร์ยอดครบแล้ว",
  "balance.scope": "รวมทุกบิลในบ้านนี้ หน่วยเป็นบาท",
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
