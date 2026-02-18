import { motion, AnimatePresence } from 'framer-motion';
import { modalVariants, overlayVariants, Springs } from '../../theme/animations';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}

export function Modal({ isOpen, onClose, children, maxWidth = 'max-w-lg' }: ModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={overlayVariants}
            onClick={onClose}
            className="fixed inset-0 bg-black/30 z-40"
          />

          {/* Modal */}
          <div className="fixed inset-0 flex items-end sm:items-center justify-center z-50 pointer-events-none p-0 sm:p-4">
            <motion.div
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={modalVariants}
              transition={{ type: 'spring', ...Springs.snappy }}
              className={`bg-white rounded-t-xxl sm:rounded-xxl p-md sm:p-lg shadow-lg ${maxWidth} w-full pointer-events-auto max-h-[90vh] overflow-y-auto`}
            >
              {children}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
