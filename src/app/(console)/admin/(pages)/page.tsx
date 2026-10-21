import { redirect } from "next/navigation";

// 대시보드는 S6에서 만든다. 그때까지 관리자 첫 화면은 파트너 관리
export default function AdminHomePage() {
  redirect("/admin/partners");
}
