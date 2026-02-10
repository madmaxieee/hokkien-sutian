import { X } from "lucide-react";

const CATEGORY_GROUPS = {
  special: ["全部"],
  strokes: [
    "首字一畫",
    "首字二畫",
    "首字三畫",
    "首字四畫",
    "首字五畫",
    "首字六畫",
    "首字七畫",
    "首字八畫",
    "首字九畫",
    "首字十畫",
    "首字十一畫",
    "首字十二畫",
    "首字十三畫",
    "首字十四畫",
    "首字十五畫",
    "首字十六畫",
    "首字十七畫",
    "首字十八畫",
    "首字十九畫",
    "首字其他筆畫",
    "一畫",
    "二畫",
    "三畫",
    "四畫",
    "五畫",
    "六畫",
    "七畫",
    "八畫",
    "九畫",
    "十畫",
    "十一畫",
    "十二畫",
    "十三畫",
    "十四畫",
    "十五畫",
    "十六畫",
    "十七畫",
    "十八畫",
    "十九畫",
    "其他筆畫",
  ],
  pos: [
    "代名詞",
    "副詞",
    "助詞、嘆詞",
    "數詞、量詞",
    "連詞、介詞",
    "疑問詞",
    "一般動詞-活動動詞",
    "一般動詞-行為動詞",
    "一般動詞-靜態動詞",
    "感官動作",
    "肢體動作",
  ],
  people: [
    "人種、民族",
    "個性風格",
    "反應、表情",
    "待人處事",
    "心理活動",
    "心理狀態",
    "性別、婚姻",
    "氣質態度",
    "生理構造",
    "生養老死",
    "稱謂輩分",
    "體態樣貌",
    "才智能力",
    "傷疾病痛",
    "宗族、家庭",
    "地位、身世、背景",
  ],
  society: [
    "國家、社會、民眾",
    "外交",
    "政治",
    "法律",
    "軍事",
    "軍公教業",
    "組織團體",
    "教育、學術",
    "道德評價",
    "神明、鬼怪、教派",
    "神職、神巫、信徒",
    "宗教場所",
    "廟宇",
    "婚喪喜慶",
    "交際應酬",
  ],
  dailyLife: [
    "生活勞動",
    "生活狀況",
    "生活用品",
    "生產工具",
    "居住環境",
    "建築物、結構",
    "房屋租賃、搬遷",
    "道路、橋梁",
    "空間方位",
    "相關器具、活動",
    "縫紉洗熨",
    "理容、化妝",
    "衣帽鞋襪",
    "珠寶飾品",
  ],
  commerce: [
    "商業",
    "財務單位、活動",
    "錢財資產",
    "服務業及其他",
    "郵電、網路",
  ],
  culture: [
    "休閒、娛樂",
    "戲劇、音樂",
    "文學、藝術",
    "文教處所",
    "體育、運動",
    "旅行",
    "旅運設施",
    "語言、文字、符號",
    "外來詞",
    "詈語",
  ],
  nature: [
    "天文",
    "地理",
    "自然現象",
    "氣候溫度",
    "時間節令",
    "節氣",
    "山脈",
    "河川",
    "海港",
    "資源礦物",
    "廢棄物",
    "災禍",
  ],
  animals: [
    "動物形體、行為",
    "其他動物",
    "昆蟲類",
    "爬蟲、兩棲類",
    "獸類",
    "禽類",
    "魚蝦海獸",
  ],
  plants: ["植物形體、狀態", "花草樹木", "蔬果作物"],
  food: ["食物、飲料、煙酒", "飲食物具", "飲食行為"],
  transport: [
    "交通、運輸",
    "安坑輕軌",
    "支線——內灣線",
    "支線——六家線",
    "支線——平溪線",
    "支線——沙崙線",
    "支線——深澳線",
    "支線——集集線",
    "東部幹線",
    "桃園機場捷運",
    "淡海輕軌",
    "新北捷運環狀線",
    "臺中捷運綠線",
    "臺北捷運中和新蘆線",
    "臺北捷運文湖線",
    "臺北捷運松山新店線",
    "臺北捷運板南線",
    "臺北捷運淡水信義線",
    "西部幹線——屏東線",
    "西部幹線——山線",
    "西部幹線——海線",
    "阿里山林業鐵路",
    "高雄捷運橘線",
    "高雄捷運紅線",
    "高雄輕軌",
  ],
  locations: [
    // 北部
    "基隆市",
    "臺北市",
    "新北市",
    "桃園市",
    "新竹市",
    "新竹縣",
    "苗栗縣",
    // 中部
    "臺中市",
    "彰化縣",
    "南投縣",
    "雲林縣",
    // 南部
    "嘉義市",
    "嘉義縣",
    "臺南市",
    "高雄市",
    "屏東縣",
    // 東部
    "宜蘭縣",
    "花蓮縣",
    "臺東縣",
    "南迴線",
    // 離島
    "澎湖縣",
    "金門縣",
    "連江縣",
  ],
  industry: ["農林業", "漁牧業", "科技、工業"],
  abstract: [
    "事、物泛稱",
    "性質、程度",
    "形貌、體積",
    "境況、狀態-擬事",
    "境況、狀態-擬人",
    "境況、狀態-擬物",
    "擬聲、擬態",
    "泛稱",
    "相關用語",
    "顏色、氣味",
    "其他",
  ],
  medical: ["醫療保健"],
};

const GROUP_ORDER = [
  "special",
  "people",
  "society",
  "dailyLife",
  "commerce",
  "culture",
  "nature",
  "animals",
  "plants",
  "food",
  "industry",
  "abstract",
  "medical",
  "strokes",
  "pos",
  "locations",
  "transport",
] as const;

const GROUP_LABELS: Record<string, string> = {
  special: "",
  people: "人物",
  society: "社會與宗教",
  dailyLife: "日常生活",
  commerce: "商業與財務",
  culture: "文化與娛樂",
  nature: "自然與地理",
  animals: "動物",
  plants: "植物",
  food: "飲食",
  industry: "產業",
  abstract: "抽象概念",
  medical: "醫療",
  strokes: "筆畫數",
  pos: "詞性",
  locations: "地區",
  transport: "交通",
};

function categorizeCategories(categories: string[]) {
  const groups: Record<string, string[]> = {
    special: [],
    people: [],
    society: [],
    dailyLife: [],
    commerce: [],
    culture: [],
    nature: [],
    animals: [],
    plants: [],
    food: [],
    industry: [],
    abstract: [],
    medical: [],
    strokes: [],
    pos: [],
    locations: [],
    transport: [],
    other: [],
  };

  // Create a set of available categories for quick lookup
  const availableCats = new Set(categories);

  // Iterate through CATEGORY_GROUPS in defined order and add categories if they exist
  for (const [group, items] of Object.entries(CATEGORY_GROUPS)) {
    for (const cat of items) {
      if (availableCats.has(cat)) {
        groups[group].push(cat);
      }
    }
  }

  // Sort strokes by the order defined in CATEGORY_GROUPS (maintain index order)
  const strokeOrder = new Map(CATEGORY_GROUPS.strokes.map((s, i) => [s, i]));
  groups.strokes.sort((a, b) => {
    const idxA = strokeOrder.get(a) ?? Infinity;
    const idxB = strokeOrder.get(b) ?? Infinity;
    return idxA - idxB;
  });

  return groups;
}

export const CategoryModal = ({
  isOpen,
  onClose,
  categories,
  onSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  categories: string[];
  onSelect: (category: string) => void;
}) => {
  if (!isOpen) return null;

  const groups = categorizeCategories(categories);

  // Use GROUP_ORDER to ensure consistent ordering
  const activeGroups = GROUP_ORDER.map(
    (name) => [name, groups[name]] as const,
  ).filter(([, items]) => items.length > 0);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center"
      onClick={onClose}
    >
      <div
        className="bg-card text-card-foreground rounded-lg shadow-xl w-full max-w-6xl max-h-[85vh] m-4 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-border">
          <h2 className="text-xl font-bold">依分類瀏覽</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X size={24} />
          </button>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {activeGroups.map(([groupName, items]) => (
            <div key={groupName} className="space-y-2">
              {GROUP_LABELS[groupName] && (
                <h3 className="font-semibold text-muted-foreground text-sm uppercase tracking-wide border-b border-border pb-1">
                  {GROUP_LABELS[groupName]}
                </h3>
              )}
              <div className="space-y-1">
                {items.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => onSelect(cat)}
                    className="w-full text-left px-2 py-1.5 rounded hover:bg-accent text-blue-600 text-sm"
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
