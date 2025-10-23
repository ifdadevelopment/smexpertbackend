import moment from "moment";

export default function formatMessages(messages, userId) {
  // Group messages by date (Today / Yesterday / DD/MM/YYYY)
  const grouped = {};

  messages.forEach((msg) => {
    const msgDate = moment(msg.createdAt);
    let dateKey;

    if (msgDate.isSame(moment(), "day")) dateKey = "Today";
    else if (msgDate.isSame(moment().subtract(1, "day"), "day"))
      dateKey = "Yesterday";
    else dateKey = msgDate.format("DD/MM/YYYY");

    if (!grouped[dateKey]) grouped[dateKey] = [];

    grouped[dateKey].push({
      id: msg._id,
      _id: msg._id,
      senderId: msg.sender._id
        ? msg.sender._id.toString()
        : msg.senderId
        ? msg.senderId.toString()
        : null,
      sender:
        msg.sender._id && msg.sender._id.toString() === userId.toString()
          ? "me"
          : msg.sender.name || msg.sender._id?.toString(),
      text: msg.content || "",
      attachments: msg.attachments || [],
      time: msgDate.format("hh:mm A"),
      createdAt: msg.createdAt,
      senderProfile: msg.sender.profileImage,
      receiverProfile: msg.receiverId?.profileImage,
    });
  });

  // Convert grouped to array with stable date order (oldest -> newest)
  const orderedDates = Object.keys(grouped).sort((a, b) => {
    const parse = (key) => {
      if (key === "Today") return moment();
      if (key === "Yesterday") return moment().subtract(1, "day");
      return moment(key, "DD/MM/YYYY");
    };
    return parse(a).diff(parse(b));
  });

  return orderedDates.map((date) => ({
    date,
    messages: grouped[date],
  }));
}
