import DeepPredictionML2Page from "@/features/deep-prediction-ml2/components_2/DeepPredictionML2Page";
import { getPredictionMatches_2 } from "@/features/deep-prediction-ml2/server_2/getPredictionMatches_2";

export default async function Page() {
  const matches = await getPredictionMatches_2();

  return <DeepPredictionML2Page matches={matches} />;
}
