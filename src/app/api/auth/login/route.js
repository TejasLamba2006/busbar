import { NextResponse } from "next/server";
import { authenticateClientKey, createApiKey, getSettings } from "@/lib/localDb";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { setDashboardAuthCookie } from "@/lib/auth/dashboardSession";
import { checkLock, recordFail, recordSuccess, getClientIp } from "@/lib/auth/loginLimiter";
import { isLocalRequest } from "@/dashboardGuard";
import { getConsistentMachineId } from "@/shared/utils/machineId";

const RESET_HINT = "Forgot password? Reset to default via 9Router CLI → Settings → Reset Password to Default.";
const NO_STORE_HEADERS = { "Cache-Control": "no-store" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isTunnelRequest(request, settings) {
  const host = (request.headers.get("host") || "").split(":")[0].toLowerCase();
  const tunnelHost = settings.tunnelUrl ? new URL(settings.tunnelUrl).hostname.toLowerCase() : "";
  const tailscaleHost = settings.tailscaleUrl ? new URL(settings.tailscaleUrl).hostname.toLowerCase() : "";
  return (tunnelHost && host === tunnelHost) || (tailscaleHost && host === tailscaleHost);
}

async function matchesMasterPassword(password, storedHash) {
  if (typeof password !== "string") return false;
  return storedHash
    ? bcrypt.compare(password, storedHash)
    : password === (process.env.INITIAL_PASSWORD || "123456");
}

function invalidLogin(ip) {
  const { remainingBeforeLock } = recordFail(ip);
  const postLock = checkLock(ip);
  if (postLock.locked) {
    return NextResponse.json(
      { error: `Too many failed attempts. Try again in ${postLock.retryAfter}s. ${RESET_HINT}`, retryAfter: postLock.retryAfter, resetHint: RESET_HINT },
      { status: 429, headers: { "Retry-After": String(postLock.retryAfter) } }
    );
  }
  return NextResponse.json(
    { error: `Invalid credentials. ${remainingBeforeLock} attempt(s) left before lockout.`, remainingBeforeLock },
    { status: 401 }
  );
}

export async function POST(request) {
  try {
    const ip = getClientIp(request);
    const lock = checkLock(ip);
    if (lock.locked) {
      return NextResponse.json(
        { error: `Too many failed attempts. Try again in ${lock.retryAfter}s. ${RESET_HINT}`, retryAfter: lock.retryAfter, resetHint: RESET_HINT },
        { status: 429, headers: { "Retry-After": String(lock.retryAfter) } }
      );
    }

    const { password, email, mode, masterPassword, clientEmail, keyName } = await request.json();
    const settings = await getSettings();

    if (isTunnelRequest(request, settings) && settings.tunnelDashboardAccess !== true) {
      return NextResponse.json({ error: "Dashboard access via tunnel is disabled" }, { status: 403 });
    }

    const storedHash = settings.password;
    if (mode === "signup") {
      if (!(await matchesMasterPassword(masterPassword, storedHash))) {
        recordFail(ip);
        return NextResponse.json({ error: "Only Master password can create client accounts." }, { status: 401 });
      }
      const normalizedEmail = typeof clientEmail === "string" ? clientEmail.trim().toLowerCase() : "";
      if (!EMAIL_RE.test(normalizedEmail)) {
        return NextResponse.json({ error: "A valid client email is required." }, { status: 400 });
      }
      const apiKey = await createApiKey(
        typeof keyName === "string" && keyName.trim() ? keyName.trim() : normalizedEmail,
        await getConsistentMachineId(),
        [],
        { clientEmail: normalizedEmail }
      );
      recordSuccess(ip);
      const cookieStore = await cookies();
      await setDashboardAuthCookie(cookieStore, request, {
        role: "client",
        apiKeyId: apiKey.id,
        apiKey: apiKey.key,
        clientEmail: apiKey.clientEmail,
      });
      return NextResponse.json({
        success: true,
        role: "client",
        clientEmail: apiKey.clientEmail,
        apiKey: apiKey.key,
      }, { headers: NO_STORE_HEADERS });
    }

    if ((!email || mode !== "client") && await matchesMasterPassword(password, storedHash)) {
      recordSuccess(ip);
      const mustChangePassword = !storedHash && !process.env.INITIAL_PASSWORD && !isLocalRequest(request);
      if (mustChangePassword) {
        return NextResponse.json(
          { success: false, error: "Default password must be changed before remote access. Change it from the local machine (or set INITIAL_PASSWORD).", mustChangePassword },
          { status: 403, headers: NO_STORE_HEADERS }
        );
      }
      const cookieStore = await cookies();
      await setDashboardAuthCookie(cookieStore, request, { role: "master" });
      return NextResponse.json({ success: true, role: "master", mustChangePassword: false }, { headers: NO_STORE_HEADERS });
    }

    const clientKey = await authenticateClientKey(email, password);
    if (!clientKey) return invalidLogin(ip);

    recordSuccess(ip);
    const cookieStore = await cookies();
    await setDashboardAuthCookie(cookieStore, request, {
      role: "client",
      apiKeyId: clientKey.id,
      apiKey: clientKey.key,
      clientEmail: clientKey.clientEmail || clientKey.name,
    });
    return NextResponse.json({
      success: true,
      role: "client",
      clientEmail: clientKey.clientEmail || clientKey.name,
      mustChangePassword: false,
    }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
