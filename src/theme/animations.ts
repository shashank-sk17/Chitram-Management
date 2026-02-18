// Framer Motion animation variants matching mobile app

export const Springs = {
  gentle: { damping: 20, stiffness: 150, mass: 1 },
  snappy: { damping: 15, stiffness: 200, mass: 0.8 },
  bouncy: { damping: 12, stiffness: 180, mass: 0.8 },
  slow: { damping: 25, stiffness: 100, mass: 1.2 },
};

export const pressAnimation = {
  whileTap: { scale: 0.97, opacity: 0.85 },
  transition: { type: 'spring', ...Springs.snappy },
};

export const modalVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: 20 },
};

export const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

export const fadeInVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

export const slideInFromBottomVariants = {
  hidden: { y: '100%', opacity: 0 },
  visible: { y: 0, opacity: 1 },
  exit: { y: '100%', opacity: 0 },
};

export const staggerChildrenVariants = {
  visible: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

export const fadeInUpVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};
