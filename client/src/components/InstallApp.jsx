import { Share, SquarePlus, Smartphone, Bell, WifiOff, Zap } from "lucide-react";
import { useInstallPrompt } from "../lib/pwa";
import { Button, Modal } from "./ui";
import { num } from "../lib/format";
import BrandMark from "./BrandMark";
import { useT } from "../i18n/I18nProvider";

/** Explains the app and installs it (one tap on Android/desktop, guided steps on iPhone). */
export default function InstallAppDialog({ open, onClose }) {
  const { native, ios, installed, promptInstall } = useInstallPrompt();
  const t = useT();
  const install = async () => {
    if ((await promptInstall()) === "accepted") onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title={t("install.title")} description={t("install.desc")}>
      <div className="stack">
        <div className="row-3">
          <BrandMark size={52} />
          <ul className="install-perks">
            <li><Zap size={14} aria-hidden /> {t("install.perkOpen")}</li>
            <li><Bell size={14} aria-hidden /> {t("install.perkNotify")}</li>
            <li><WifiOff size={14} aria-hidden /> {t("install.perkOffline")}</li>
          </ul>
        </div>
        {installed ? (
          <p className="text-sm muted">{t("install.already")}</p>
        ) : native ? (
          <Button variant="primary" icon={Smartphone} block onClick={install}>{t("install.install")}</Button>
        ) : ios ? (
          <ol className="install-steps">
            <li><span className="install-num">{num(1)}</span> {t("install.ios1a")}<Share size={15} aria-label={t("install.share")} className="install-ico" /> <strong>{t("install.share")}</strong>{t("install.ios1b")}</li>
            <li><span className="install-num">{num(2)}</span> {t("install.ios2a")}<SquarePlus size={15} aria-hidden className="install-ico" /> <strong>{t("install.addHome")}</strong>{t("install.ios2b")}</li>
            <li><span className="install-num">{num(3)}</span> {t("install.ios3a")}<strong>{t("install.add")}</strong>{t("install.ios3b")}</li>
          </ol>
        ) : (
          <ol className="install-steps">
            <li><span className="install-num">{num(1)}</span> {t("install.other1")}</li>
            <li><span className="install-num">{num(2)}</span> {t("install.other2")}</li>
          </ol>
        )}
      </div>
    </Modal>
  );
}
