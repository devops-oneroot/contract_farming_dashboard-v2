import { Suspense } from "react";
import { PeopleTable } from "../components/people-list";
import { LoadingBlock } from "../components/loading";

// Suspense: the shared table reads search params from the URL.
export default function AgronomistsPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <PeopleTable role="agronomist" />
    </Suspense>
  );
}
