import { usePOSStore } from "@/lib/pos-store";
import EnhancedDayCloseModal from "./enhanced-day-close-modal";

export default function DayCloseModal() {
  const {
    isDayCloseModalOpen,
    closeDayCloseModal,
    currentDay
  } = usePOSStore();

  const handleClose = () => {
    closeDayCloseModal();
  };

  return (
    <EnhancedDayCloseModal
      isOpen={isDayCloseModalOpen}
      onClose={handleClose}
      dayOperation={currentDay}
    />
  );
}