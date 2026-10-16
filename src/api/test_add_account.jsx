import supabase from "../../lib/supabase_client.jsx"

export default async function addUser() {
	const { data, error } = await supabase.from("profiles").insert([{
		name: "test",
		phone: "9018292923",
		role: "owner",
	}]);

	if (data) return true;
	else return false;
}