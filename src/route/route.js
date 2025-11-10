// routes/route.js
import {
  createGroupController,
  getUserGroups,
  getUserGroupsController,
  getGroupController,
  getGroupsController,
  updateGroupController,
  addMemberController,
  removeMemberController,
  makeAdminController,
  deleteGroupController,
  sendGroupMessageController,
  deleteGroupMessageController,
  listGroupMessagesController,
  hideMemberController,
  deleteForMeController,
  deleteForEveryoneController,
  getGroupMessagesController,
  getGroupControllers,
  getGroupWithDetailsController,
  updateGroupMembers,
  sendGroupMessage,
  getGroupMessages,
  getGroupConversationController,
} from "../controlers/groupControler/groups.controler.js";

import {
  uploadChatAny,
  uploadProfileImage,
  extractS3Uploads,
  uploadPaymentImage,
  uploadGroupProfileImage,
} from "../middleware/upload.js";

import {
  getChats,
  getUserConversation,
  sendMessage,
} from "../controlers/messageControler/chats.controlers.js";
import { getUserConversations } from "../controlers/messageControler/conversiation.controler.js";

import {
  adminUpdatePayment,
  createPayment,
  deletePayment,
  getPayment,
  listPayments,
} from "../controlers/Payment/Payment.js";

import {
  createUserSessionHandler,
  getSessionHandler,
  reIssueAccessTokenSessionHandler,
  updateSessionHandler,
} from "../controlers/session.controlers.js";

import { saveToken, sendByProjectId, resetBadge } from "../controlers/notifications.js";
import userRegisterControler, {
  getUsersByBranchController,
  getUserByIdController,
  updateUserController,
  userManagementController,
  createBranchController,
  adminListAllBranchesController,
  adminGetUsersByBranchIdController,
  forgotPassword,
  resetPassword,
  getUserStatus,
} from "../controlers/user.controlers.js";

import { updateProfileController } from "../controlers/user.profile.controllers.js";
import { updateGroupControllers } from "../controlers/groupControler/updateGroupController.js";
import { authGuard, requireAdmin } from "../middleware/auth.middleware.js";
import requireUser from "../middleware/require.user.js";
import validateUser from "../middleware/validateUser.middleware.js";

import groupSchema from "../schema/groupConversationSchema/group.conversation.schema.js";
import { userLoginSchema, userRegisterSchema } from "../schema/user.schema.js";

const routeFunc = (app) => {
  /* Auth + Session (PUBLIC) */
  app.post("/login", validateUser(userLoginSchema), createUserSessionHandler);
  app.post("/get-access-token", reIssueAccessTokenSessionHandler);
  app.post("/re-issue-access-token", reIssueAccessTokenSessionHandler);

  /* Protected session read/logout */
  app.get("/session", requireUser, getSessionHandler);
  app.post("/logout", requireUser, updateSessionHandler);

  /* User mgmt */
  app.post(
    "/register",
    validateUser(userRegisterSchema),
    userRegisterControler
  );
  app.get("/get-all-user", requireUser, userManagementController);
  app.post("/update-user/:id", requireUser, updateUserController);
  app.get("/users/by-branch", requireUser, getUsersByBranchController);
  app.get("/user-status/:id", requireUser, getUserStatus);
  /* Profile (multipart allowed) */
  app.put(
    "/profile/update",
    requireUser,
    uploadProfileImage,
    extractS3Uploads,
    updateProfileController
  );

  /* Chats / Conversations */
  app.get("/get-user-converstaion", requireUser, getUserConversations);
  app.get("/get-user-converstaions", requireUser, getUserConversation);
  app.post(
    "/chat/:id",
    requireUser,
    uploadChatAny,
    extractS3Uploads,
    sendMessage
  );
  app.get("/chat/:id", requireUser, getChats);
  app.post("/forgot-password", forgotPassword);
  app.post("/reset-password", resetPassword);
  app.get("/user/:id", requireUser, getUserByIdController);
  app.post("/branches", requireUser, createBranchController);
  app.get("/admin/branches", adminListAllBranchesController);
  app.get("/admin/branches/:branchId/users", adminGetUsersByBranchIdController);
  app.get("/get-user-converstaion", requireUser, getUserConversations);
  /* Notifications */
  app.post("/save-token", saveToken);
  app.post("/send-by-project", sendByProjectId);
  app.post("/reset-badge", resetBadge);





  /* Groups */
  app.post(
    "/create-group",
    validateUser(groupSchema),
    requireUser,
    createGroupController
  );
  app.post(
    "/group/:groupId/message",
    requireUser,
    uploadChatAny,
    extractS3Uploads,
    sendGroupMessage
  );
  app.get("/group/:groupId/messages", requireUser, getGroupMessages);
  app.get("/get-group-conversation", requireUser, getUserGroups);
  app.get("/get-group-conversations", requireUser, getGroupConversationController);
  app.get("/get-group-userGroup/:id", requireUser, getUserGroupsController);
  //  app.get("/groups", requireUser, getGroupsController);
  app.get("/group/:id", requireUser, getGroupController);
  app.get("/groups/:id", requireUser, getGroupControllers);
  app.get("/groups/:id/messages", requireUser, listGroupMessagesController);
  app.get("/groups/:id/details", requireUser, getGroupWithDetailsController);
  app.patch(
    "/groups/:id",
    requireUser,
    uploadChatAny,
    extractS3Uploads,
    updateGroupController
  );
  app.post("/groups/:id/members", requireUser, addMemberController);
  app.delete(
    "/groups/:id/members/:userId",
    requireUser,
    removeMemberController
  );
  app.patch("/groups/:id/members/:userId", requireUser, hideMemberController);
  app.put("/groups/:groupId/members", requireUser, updateGroupMembers);
  app.post(
    "/groups/:id/messages",
    requireUser,
    uploadChatAny,
    extractS3Uploads,
    sendGroupMessageController
  );
  app.get("/group/:id", requireUser, getGroupController);
  app.put(
    "/groups/:id/update",
    requireUser,
    uploadGroupProfileImage,
    extractS3Uploads,
    updateGroupControllers
  );
  app.delete(
    "/groups/:id/messages/:messageId",
    requireUser,
    deleteGroupMessageController
  );
  app.delete(
    "/groups/:id/messages/:messageId/for-me",
    requireUser,
    deleteForMeController
  );
  app.delete(
    "/groups/:id/messages/:messageId/for-everyone",
    requireUser,
    deleteForEveryoneController
  );
  app.get("/groups/:id/messages", requireUser, getGroupMessagesController);
  /* Payments */
  app.post(
    "/payments",
    requireUser,
    uploadPaymentImage,
    extractS3Uploads,
    createPayment
  );
  app.get("/payments", requireUser, listPayments);
  app.get("/payments/:id([0-9a-fA-F]{24})", requireUser, getPayment);
  app.put(
    "/payments/:id([0-9a-fA-F]{24})",
    requireUser,
    uploadPaymentImage,
    extractS3Uploads,
    adminUpdatePayment
  );
  app.delete("/payments/:id([0-9a-fA-F]{24})", requireUser, deletePayment);
};

export default routeFunc;
