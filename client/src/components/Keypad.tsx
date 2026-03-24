import { Delete } from "lucide-react";

interface KeypadProps {
  onValueChange: (value: string) => void;
  value: string;
}

export function Keypad({ value, onValueChange }: KeypadProps) {
  const handlePress = (key: string) => {
    if (key === "backspace") {
      onValueChange(value.slice(0, -1));
      return;
    }
    
    if (key === "." && value.includes(".")) return;
    
    // Max length prevention
    if (value.length > 12) return;
    
    onValueChange(value + key);
  };

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "backspace"];

  return (
    <div className="grid grid-cols-3 gap-3 p-4">
      {keys.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => handlePress(key)}
          className={`
            h-14 rounded-2xl text-xl font-medium transition-all duration-100 active:scale-95
            flex items-center justify-center
            ${key === "backspace" 
              ? "bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive" 
              : "bg-white border border-border/50 text-foreground hover:bg-primary/5 shadow-sm"}
          `}
        >
          {key === "backspace" ? <Delete className="w-6 h-6" /> : key}
        </button>
      ))}
    </div>
  );
}
