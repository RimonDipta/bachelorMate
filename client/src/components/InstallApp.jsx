import { Share, SquarePlus, Smartphone, Bell, WifiOff, Zap } from "lucide-react";
import { useInstallPrompt } from "../lib/pwa";
import { Button, Modal } from "./ui";
import BrandMark from "./BrandMark";

/** Explains the app and installs it (one tap on Android/desktop, guided steps on iPhone). */
export default function InstallAppDialog({ open, onClose }) {
  const { native, ios, installed, promptInstall } = useInstallPrompt();
  const install = async () => {
    if ((await promptInstall()) === "accepted") onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Get the BachelorMate app" description="Free, no app store needed, and it takes a few seconds.">
      <div className="stack">
        <div className="row-3">
          <BrandMark size={52} />
          <ul className="install-perks">
            <li><Zap size={14} aria-hidden /> Opens straight from your home screen</li>
            <li><Bell size={14} aria-hidden /> Notifications for payments, meals and messages</li>
            <li><WifiOff size={14} aria-hidden /> Starts even on a bad connection</li>
          </ul>
        </div>
        {installed ? (
          <p className="text-sm muted">You're already using the installed app.</p>
        ) : native ? (
          <Button variant="primary" icon={Smartphone} block onClick={install}>Install app</Button>
        ) : ios ? (
          <ol className="install-steps">
            <li><span className="install-num">1</span> Tap <Share size={15} aria-label="Share" className="install-ico" /> <strong>Share</strong> in Safari's toolbar.</li>
            <li><span className="install-num">2</span> Choose <SquarePlus size={15} aria-hidden className="install-ico" /> <strong>Add to Home Screen</strong>.</li>
            <li><span className="install-num">3</span> Tap <strong>Add</strong>. Open BachelorMate from your home screen to turn on notifications.</li>
          </ol>
        ) : (
          <ol className="install-steps">
            <li><span className="install-num">1</span> Open this site in <strong>Chrome</strong> (Android) or <strong>Chrome / Edge</strong> (computer).</li>
            <li><span className="install-num">2</span> Open the browser menu <strong>⋮</strong> and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
          </ol>
        )}
      </div>
    </Modal>
  );
}
