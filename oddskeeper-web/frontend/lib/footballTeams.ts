import alanyasporLogo from "@/images/football_logos/alanyaspor.png";
import antalyasporLogo from "@/images/football_logos/antalyaspor.png";
import basaksehirLogo from "@/images/football_logos/basaksehir.png";
import besiktasLogo from "@/images/football_logos/besiktas.png";
import eyupsporLogo from "@/images/football_logos/eyupspor.png";
import fenerbahceLogo from "@/images/football_logos/fenerbahce.png";
import galatasarayLogo from "@/images/football_logos/galatasaray.png";
import gaziantepLogo from "@/images/football_logos/gaziantep.png";
import genclerbirligiLogo from "@/images/football_logos/genclerbirligi.png";
import goztepeLogo from "@/images/football_logos/goztepe.png";
import karagumrukLogo from "@/images/football_logos/karagumruk.png";
import kasimpasaLogo from "@/images/football_logos/kasimpasa.png";
import kayserisporLogo from "@/images/football_logos/kayserispor.png";
import kocaelisporLogo from "@/images/football_logos/kocaelispor.png";
import konyasporLogo from "@/images/football_logos/konyaspor.png";
import rizesporLogo from "@/images/football_logos/rizespor.png";
import samsunsporLogo from "@/images/football_logos/samsunspor.png";
import trabzonsporLogo from "@/images/football_logos/trabzonspor.png";

export type FootballTeam = {
  slug: string;
  name: string;
  logo: any;
};

export const footballTeams: FootballTeam[] = [
  { slug: "alanyaspor", name: "Alanyaspor", logo: alanyasporLogo },
  { slug: "antalyaspor", name: "Antalyaspor", logo: antalyasporLogo },
  { slug: "basaksehir", name: "Başakşehir", logo: basaksehirLogo },
  { slug: "besiktas", name: "Beşiktaş", logo: besiktasLogo },
  { slug: "eyupspor", name: "Eyüpspor", logo: eyupsporLogo },
  { slug: "fenerbahce", name: "Fenerbahçe", logo: fenerbahceLogo },
  { slug: "galatasaray", name: "Galatasaray", logo: galatasarayLogo },
  { slug: "gaziantep", name: "Gaziantep FK", logo: gaziantepLogo },
  { slug: "genclerbirligi", name: "Gençlerbirliği", logo: genclerbirligiLogo },
  { slug: "goztepe", name: "Göztepe", logo: goztepeLogo },
  { slug: "karagumruk", name: "Karagümrük", logo: karagumrukLogo },
  { slug: "kasimpasa", name: "Kasımpaşa", logo: kasimpasaLogo },
  { slug: "kayserispor", name: "Kayserispor", logo: kayserisporLogo },
  { slug: "kocaelispor", name: "Kocaelispor", logo: kocaelisporLogo },
  { slug: "konyaspor", name: "Konyaspor", logo: konyasporLogo },
  { slug: "rizespor", name: "Rizespor", logo: rizesporLogo },
  { slug: "samsunspor", name: "Samsunspor", logo: samsunsporLogo },
  { slug: "trabzonspor", name: "Trabzonspor", logo: trabzonsporLogo },
];