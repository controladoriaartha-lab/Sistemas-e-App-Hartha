import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/treino/$id")({ component: WorkoutLayout });

function WorkoutLayout() {
  return <Outlet />;
}
