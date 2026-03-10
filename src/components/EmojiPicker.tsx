import React, { useState } from 'react';

const EMOJI_CATEGORIES: Record<string, string[]> = {
  '😀 Carinhas': ['😀','😃','😄','😁','😅','😂','🤣','😊','😇','🙂','😉','😍','🥰','😘','😗','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','😮‍💨','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖'],
  '👋 Mãos': ['👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💅','🤳','💪'],
  '❤️ Amor': ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟'],
  '🎉 Objetos': ['🎉','🎊','🎁','🏆','🥇','🥈','🥉','⚽','🏀','🏈','⚾','🎾','🏐','🎯','🔥','⭐','🌟','💫','✨','🎵','🎶','🔔','📱','💻','📧','📞','📅','📌','📎','✏️','📝','💼','📊','📈','💰','💵','💳','🏦'],
  '✅ Símbolos': ['✅','❌','⚠️','🚫','💯','❗','❓','⁉️','‼️','🔴','🟢','🟡','🔵','⚪','⚫','🟠','🟣','🟤','➡️','⬅️','⬆️','⬇️','↗️','↘️','↙️','↖️','🔄','🔃','🆕','🆗','🔝','🔜','🔚','🔛']
};

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
}

const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelect }) => {
  const categories = Object.keys(EMOJI_CATEGORIES);
  const [activeCategory, setActiveCategory] = useState(categories[0]);

  return (
    <div className="w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
      {/* Category tabs */}
      <div className="flex border-b border-slate-700 overflow-x-auto scrollbar-hide">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-2 text-sm whitespace-nowrap transition-colors ${
              activeCategory === cat 
                ? 'bg-slate-800 text-cyan-400 border-b-2 border-cyan-400' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            {cat.split(' ')[0]}
          </button>
        ))}
      </div>
      
      {/* Emoji grid */}
      <div className="p-2 h-48 overflow-y-auto">
        <div className="grid grid-cols-8 gap-0.5">
          {EMOJI_CATEGORIES[activeCategory].map((emoji, i) => (
            <button
              key={i}
              onClick={() => onSelect(emoji)}
              className="w-8 h-8 flex items-center justify-center text-lg hover:bg-slate-700 rounded transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EmojiPicker;
