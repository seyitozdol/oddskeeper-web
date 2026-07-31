import TslHub from "../../../../features/tsl/hub/TslHub";

export const metadata = {
  title: "TSL · Süper Lig",
};

export default function TslHubPage() {
  return (
    <section className="px-4 py-6 lg:px-8 lg:py-8">
      <TslHub />
    </section>
  );
}
