import ProjectPage from "@/app/projects/[id]/page";

export const dynamic = "force-dynamic";

interface CompoundDetailsPageProps {
  params: {
    slug: string;
  };
}

export default async function CompoundDetailsPage({ params }: CompoundDetailsPageProps) {
  return <ProjectPage params={{ id: params.slug }} />;
}
