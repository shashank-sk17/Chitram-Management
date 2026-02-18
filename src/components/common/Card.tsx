interface CardProps {
  children: React.ReactNode;
  color?: string;
  className?: string;
}

export function Card({ children, color = 'bg-white', className = '' }: CardProps) {
  return (
    <div className={`rounded-lg sm:rounded-xl p-md sm:p-lg shadow-sm ${color} ${className}`}>
      {children}
    </div>
  );
}
