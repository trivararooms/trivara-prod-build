import React, { useState, useEffect, useRef } from 'react';

interface CounterInputProps {
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    label?: string;
    className?: string;
}

const stepButtonClass =
    'nu-chip grid h-10 w-10 place-items-center rounded-full text-xl leading-none transition-transform active:scale-90 disabled:cursor-not-allowed disabled:opacity-30';

export function CounterInput({
    value,
    onChange,
    min = 0,
    max = 20,
    label,
    className = '',
}: CounterInputProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [inputValue, setInputValue] = useState(value.toString());
    // Per-instance double-tap tracking (a `window.lastTap` global used to be
    // shared across every CounterInput on the page, so tapping one quickly
    // after another could spuriously trigger edit mode on the wrong one).
    const lastTapRef = useRef(0);

    useEffect(() => {
        setInputValue(value.toString());
    }, [value]);

    const handleIncrement = () => {
        if (value < max) {
            onChange(value + 1);
        }
    };

    const handleDecrement = () => {
        if (value > min) {
            onChange(value - 1);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
    };

    const handleBlur = () => {
        setIsEditing(false);
        let newValue = parseInt(inputValue, 10);

        if (isNaN(newValue)) {
            newValue = min;
        } else {
            newValue = Math.max(min, Math.min(max, newValue));
        }

        setInputValue(newValue.toString());
        onChange(newValue);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleBlur();
        }
    };

    return (
        <div className={`flex flex-col ${className}`}>
            {label && <label className="block text-sm text-text-secondary mb-2">{label}</label>}
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    aria-label="Decrease"
                    className={stepButtonClass}
                    onClick={handleDecrement}
                    disabled={value <= min}
                >
                    −
                </button>

                {isEditing ? (
                    <input
                        type="number"
                        className="w-12 text-center font-ui text-base font-extrabold bg-surface-2 rounded-full outline-none border-b-2 border-accent"
                        value={inputValue}
                        onChange={handleInputChange}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        autoFocus
                        min={min}
                        max={max}
                    />
                ) : (
                    <span
                        className="w-8 text-center font-ui text-base font-extrabold tabular-nums cursor-pointer select-none"
                        onDoubleClick={() => setIsEditing(true)}
                        onTouchStart={() => {
                            // Simple double tap detection for mobile
                            const now = Date.now();
                            if (now - lastTapRef.current < 300) {
                                setIsEditing(true);
                            }
                            lastTapRef.current = now;
                        }}
                    >
                        {value}
                    </span>
                )}

                <button
                    type="button"
                    aria-label="Increase"
                    className={stepButtonClass}
                    onClick={handleIncrement}
                    disabled={value >= max}
                >
                    +
                </button>
            </div>
        </div>
    );
}
