import { supabase } from "../../lib/supabase_client.jsx";

// export default async function addUser() {
// 	const { data, error } = await supabase.from("bookings").insert({
// 		court_id: 1,
// 		customer_id: "test",
// 		name: "test",
// 		phone: "9018292923",
// 		role: "owner",
// 	}).select();

// 	if (error) {
// 		console.log("Error", error.message);
// 		return false;
// 	}

// 	console.log("Success, data inserted: ", data);
// 	return true;
// }