import { Suspense } from "react";
import { PeopleTable } from "../components/people-list";
import { LoadingBlock } from "../components/loading";

// Suspense: the table reads ?unassigned=&highlight= from the URL.
export default function FarmersPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <PeopleTable role="farmer" />
    </Suspense>
  );
}
