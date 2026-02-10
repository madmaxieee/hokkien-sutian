import type { PhoneticDifference } from "../types";
import { CopyableText } from "./common";

export const PhoneticDifferencesTable = ({
  data,
  alwaysShowButtons = true,
}: {
  data: PhoneticDifference | null;
  alwaysShowButtons?: boolean;
}) => {
  if (!data) return null;

  const order: { [key: string]: number } = {
    yi_lan_zhang: 1,
    tai_zhong_zhang: 2,
    tai_nan_mix: 3,
    gao_xiong_mix: 4,
    san_xia_quan: 5,
    taipei_quan: 6,
    jin_men_quan: 7,
    ma_gong_quan: 8,
    xin_zhu_quan: 9,
    lu_gang_quan: 10,
  };

  const labels: { [key: string]: string } = {
    yi_lan_zhang: "宜蘭偏漳腔",
    tai_zhong_zhang: "臺中偏漳腔",
    tai_nan_mix: "臺南混合腔",
    gao_xiong_mix: "高雄混合腔",
    san_xia_quan: "三峽偏泉腔",
    taipei_quan: "臺北偏泉腔",
    jin_men_quan: "金門偏泉腔",
    ma_gong_quan: "馬公偏泉腔",
    xin_zhu_quan: "新竹偏泉腔",
    lu_gang_quan: "鹿港偏泉腔",
  };

  const sortedPhonetics = Object.entries(data)
    .filter(([key, value]) => order[key] && value)
    .sort(([keyA], [keyB]) => order[keyA] - order[keyB])
    .map(([key, value]) => ({ label: labels[key], value: value as string }));

  if (sortedPhonetics.length === 0) return null;

  // Track which pronunciation values have already been shown
  const seenValues = new Set<string>();

  return (
    <div className="mt-6">
      <h3 className="text-xl font-semibold mb-3">語音差異</h3>
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-accent">
            <tr>
              <th className="p-3 font-medium text-muted-foreground">腔</th>
              <th className="p-3 font-medium text-muted-foreground">
                語音差異
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sortedPhonetics.map((item) => {
              const isFirstOccurrence = !seenValues.has(item.value);
              if (isFirstOccurrence) {
                seenValues.add(item.value);
              }
              return (
                <tr key={item.label} className="hover:bg-accent">
                  <td className="p-3 text-foreground">{item.label}</td>
                  <td className="p-3 text-blue-600 font-mono">
                    <CopyableText
                      text={item.value}
                      alwaysShowButtons={alwaysShowButtons && isFirstOccurrence}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
