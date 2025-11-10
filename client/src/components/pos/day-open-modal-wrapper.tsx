import { usePOSStore } from "@/lib/pos-store";
import DayOpenModal from "./day-open-modal";

export default function DayOpenModalWrapper() {
  const {
    isDayOpenModalOpen,
    closeDayOpenModal,
    setCurrentDay,
    setIsDayOpen
  } = usePOSStore();

  const handleDayOpened = (dayOperation: any) => {
    setCurrentDay(dayOperation);
    setIsDayOpen(true);
  };

  return (
    <DayOpenModal
      isOpen={isDayOpenModalOpen}
      onClose={closeDayOpenModal}
      onDayOpened={handleDayOpened}
    />
  );
}