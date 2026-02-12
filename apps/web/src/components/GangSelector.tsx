'use client';

interface Gang {
    id: string;
    name: string;
    subscriptionTier: string;
}

interface GangSelectorProps {
    gangs: Gang[];
    selectedGangId?: string;
    onSelect: (gangId: string) => void;
}

export function GangSelector({ gangs, selectedGangId, onSelect }: GangSelectorProps) {
    return (
        <select
            value={selectedGangId || ''}
            onChange={(e) => onSelect(e.target.value)}
            className="bg-discord-dark border border-gray-600 rounded-lg px-4 py-2 text-white"
        >
            <option value="">เลือกแก๊ง</option>
            {gangs.map((gang) => (
                <option key={gang.id} value={gang.id}>
                    {gang.name} ({gang.subscriptionTier})
                </option>
            ))}
        </select>
    );
}
