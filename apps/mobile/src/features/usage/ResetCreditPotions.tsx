import { View } from "react-native";
import { Path, Rect, Svg } from "react-native-svg";

export function ResetCreditPotions({ count }: { readonly count: number }) {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${count} reset ${count === 1 ? "credit" : "credits"} available`}
      className="shrink-0 flex-row flex-wrap items-center gap-0.5"
    >
      {Array.from({ length: Math.max(3, count) }, (_, index) => {
        const filled = index < count;
        return (
          <Svg key={index} width={16} height={20} viewBox="0 0 20 24" fill="none">
            <Path
              d="M7 5v4l-3.5 5a5 5 0 0 0 4.1 8h4.8a5 5 0 0 0 4.1-8L13 9V5"
              fill="#a78bfa"
              fillOpacity={filled ? 0.08 : 0.04}
              stroke="#a78bfa"
              strokeOpacity={filled ? 0.8 : 0.3}
              strokeWidth={1.5}
              strokeLinejoin="round"
            />
            {filled ? (
              <>
                <Path
                  d="M5.3 14h9.4l.6.9a3.5 3.5 0 0 1-2.9 5.6H7.6a3.5 3.5 0 0 1-2.9-5.6Z"
                  fill="#a78bfa"
                />
                <Path d="M6.5 16a2 2 0 0 0 0 2.5" stroke="#ede9fe" strokeLinecap="round" />
              </>
            ) : null}
            <Rect
              x={6}
              y={1.5}
              width={8}
              height={4}
              rx={1}
              fill={filled ? "#d6a36d" : "#a78bfa"}
              fillOpacity={filled ? 1 : 0.25}
            />
            <Path d="M6 6.5h8" stroke="#a78bfa" strokeOpacity={filled ? 0.8 : 0.3} />
          </Svg>
        );
      })}
    </View>
  );
}
