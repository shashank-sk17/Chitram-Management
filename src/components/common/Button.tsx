import { motion } from 'framer-motion';
import { pressAnimation } from '../../theme/animations';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'accent' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  className?: string;
}

const variantClasses = {
  primary: 'bg-primary text-white shadow-md',
  secondary: 'bg-accent text-white shadow-md',
  outline: 'border-2 border-primary text-primary bg-transparent',
  danger: 'bg-error text-white shadow-md',
  accent: 'bg-secondary text-white shadow-md',
  ghost: 'bg-transparent text-text-body',
};

const sizeClasses = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-5 py-3 text-sm sm:text-md',
  lg: 'px-6 py-3 sm:py-4 text-md sm:text-body',
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  className = '',
}: ButtonProps) {
  return (
    <motion.button
      onClick={onPress}
      disabled={disabled || loading}
      whileTap={pressAnimation.whileTap}
      transition={pressAnimation.transition as any}
      className={`
        rounded-full
        font-baloo font-semibold
        tracking-wide
        flex items-center justify-center gap-sm
        transition-opacity
        whitespace-nowrap
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
    >
      {loading ? (
        <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <>
          {icon}
          <span>{title}</span>
        </>
      )}
    </motion.button>
  );
}
