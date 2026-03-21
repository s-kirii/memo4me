import { execFileSync } from "node:child_process";
import { HttpError } from "../utils/http-error";
import type { AiProviderId, AiSecretStorageStatus } from "../types";

export type SecretStorageMeta = {
  storage: "" | "keychain" | "dpapi";
  ref: string;
};

const KEYCHAIN_SERVICE_NAME = "memo4me.ai";

function runCommand(
  command: string,
  args: string[],
  env?: Record<string, string>,
) {
  return execFileSync(command, args, {
    encoding: "utf8",
    env: {
      ...process.env,
      ...env,
    },
  }).trim();
}

function isWindows() {
  return process.platform === "win32";
}

function isMac() {
  return process.platform === "darwin";
}

export class PlatformSecretStore {
  getStatus(): AiSecretStorageStatus {
    if (isMac()) {
      return {
        strategy: "keychain",
        supported: true,
        note: "API keys are stored in macOS Keychain.",
      };
    }

    if (isWindows()) {
      return {
        strategy: "dpapi",
        supported: true,
        note: "API keys are stored with Windows DPAPI protection.",
      };
    }

    return {
      strategy: "unsupported",
      supported: false,
      note: "AI key storage is supported on macOS and Windows only.",
    };
  }

  save(provider: AiProviderId, secret: string): SecretStorageMeta {
    if (isMac()) {
      runCommand("security", [
        "add-generic-password",
        "-U",
        "-s",
        KEYCHAIN_SERVICE_NAME,
        "-a",
        provider,
        "-w",
        secret,
      ]);

      return {
        storage: "keychain",
        ref: `${KEYCHAIN_SERVICE_NAME}:${provider}`,
      };
    }

    if (isWindows()) {
      const script =
        "[Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::UTF8.GetBytes($env:MEMO4ME_SECRET), $null, [Security.Cryptography.DataProtectionScope]::CurrentUser))";
      const encrypted = runCommand(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-Command", script],
        { MEMO4ME_SECRET: secret },
      );

      return {
        storage: "dpapi",
        ref: encrypted,
      };
    }

    throw new HttpError(
      501,
      "AI_STORAGE_UNSUPPORTED",
      "AI key storage is supported on macOS and Windows only",
    );
  }

  read(provider: AiProviderId, meta: SecretStorageMeta) {
    if (!meta.storage || !meta.ref) {
      return null;
    }

    if (meta.storage === "keychain" && isMac()) {
      try {
        return runCommand("security", [
          "find-generic-password",
          "-s",
          KEYCHAIN_SERVICE_NAME,
          "-a",
          provider,
          "-w",
        ]);
      } catch {
        return null;
      }
    }

    if (meta.storage === "dpapi" && isWindows()) {
      const script =
        "[Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String($env:MEMO4ME_SECRET_REF), $null, [Security.Cryptography.DataProtectionScope]::CurrentUser))";

      try {
        return runCommand(
          "powershell.exe",
          ["-NoProfile", "-NonInteractive", "-Command", script],
          { MEMO4ME_SECRET_REF: meta.ref },
        );
      } catch {
        return null;
      }
    }

    return null;
  }

  clear(provider: AiProviderId, meta: SecretStorageMeta) {
    if (meta.storage === "keychain" && isMac()) {
      try {
        runCommand("security", [
          "delete-generic-password",
          "-s",
          KEYCHAIN_SERVICE_NAME,
          "-a",
          provider,
        ]);
      } catch {
        return;
      }
    }
  }
}
