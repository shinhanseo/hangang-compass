declare global {
  interface Window {
    Kakao?: {
      isInitialized(): boolean;
      init(key: string): void;
      Share: {
        sendDefault(options: {
          objectType: "text";
          text: string;
          link: { mobileWebUrl: string; webUrl: string };
          buttonTitle: string;
        }): void;
      };
    };
  }
}

const KAKAO_SDK_URL = "https://t1.kakaocdn.net/kakao_js_sdk/2.8.2/kakao.min.js";

async function kakaoSdk(key: string) {
  if (!window.Kakao) {
    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(`script[src="${KAKAO_SDK_URL}"]`);
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("Kakao SDK unavailable")), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = KAKAO_SDK_URL;
      script.async = true;
      script.crossOrigin = "anonymous";
      script.addEventListener("load", () => resolve(), { once: true });
      script.addEventListener("error", () => reject(new Error("Kakao SDK unavailable")), { once: true });
      document.head.append(script);
    });
  }
  if (!window.Kakao) throw new Error("Kakao SDK unavailable");
  if (!window.Kakao.isInitialized()) window.Kakao.init(key);
  return window.Kakao;
}

async function nativeShare(url: string, text: string) {
  if (!navigator.share) throw new Error("Native share unavailable");
  await navigator.share({ title: "한강 피크닉 초대", text, url });
}

export async function shareInviteToKakao(url: string, meetingAt: string) {
  const text = `${meetingAt} 한강 피크닉에 초대했어요. 이동시간과 도착 혼잡을 함께 비교해 만날 공원을 정해요.`;
  const key = import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY?.trim();
  if (!key) {
    await nativeShare(url, text);
    return "native" as const;
  }
  try {
    const kakao = await kakaoSdk(key);
    kakao.Share.sendDefault({
      objectType: "text",
      text,
      link: { mobileWebUrl: url, webUrl: url },
      buttonTitle: "초대장 열기",
    });
    return "kakao" as const;
  } catch {
    await nativeShare(url, text);
    return "native" as const;
  }
}

