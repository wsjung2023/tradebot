import { useState, useCallback } from "react";

const LS_ENABLED = "real_account_lock_enabled";
const LS_PIN = "real_account_lock_pin";

function getStored() {
  return {
    enabled: localStorage.getItem(LS_ENABLED) === "true",
    pin: localStorage.getItem(LS_PIN) ?? "",
  };
}

export function useRealAccountLock() {
  const [enabled, setEnabledState] = useState(() => getStored().enabled);
  const [pin, setPinState] = useState(() => getStored().pin);
  // 세션 내 잠금 해제 여부 (새로고침 시 초기화)
  const [sessionUnlocked, setSessionUnlocked] = useState(false);

  const enable = useCallback((newPin: string) => {
    localStorage.setItem(LS_ENABLED, "true");
    localStorage.setItem(LS_PIN, newPin);
    setEnabledState(true);
    setPinState(newPin);
    setSessionUnlocked(false);
  }, []);

  const disable = useCallback(() => {
    localStorage.setItem(LS_ENABLED, "false");
    localStorage.removeItem(LS_PIN);
    setEnabledState(false);
    setPinState("");
    setSessionUnlocked(true);
  }, []);

  const unlock = useCallback((entered: string): boolean => {
    const stored = getStored();
    if (entered === stored.pin) {
      setSessionUnlocked(true);
      return true;
    }
    return false;
  }, []);

  const lock = useCallback(() => {
    setSessionUnlocked(false);
  }, []);

  // 실계좌 선택 시 잠금 여부
  const isLocked = enabled && !sessionUnlocked;

  return { enabled, pin, isLocked, sessionUnlocked, enable, disable, unlock, lock };
}
