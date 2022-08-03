import {
  useMeeting,
  useParticipant,
  usePubSub,
} from "@videosdk.live/react-sdk";
import { useEffect, useRef, useState } from "react";
import { useMeetingAppContext } from "../MeetingAppContextDef";
import ConfirmBox from "./ConfirmBox";
import { meetingModes } from "../CONSTS";
import { useSnackbar } from "notistack";

const reqInfoDefaultState = {
  enabled: false,
  mode: null,
  accept: () => {},
  reject: () => {},
};

const ModeListner = () => {
  const { enqueueSnackbar } = useSnackbar();
  const mMeetingRef = useRef();
  const {
    setMeetingMode,
    meetingMode,
    setSideBarMode,
    notificationSoundEnabled,
    notificationAlertsEnabled,
    setCohostActiveState,
    cohostActiveState,
    hostId,
  } = useMeetingAppContext();

  const [reqModeInfo, setReqModeInfo] = useState(reqInfoDefaultState);

  const mMeeting = useMeeting();
  const localParticipantId = mMeeting?.localParticipant?.id;
  const participant = useParticipant(localParticipantId);
  const { publish } = usePubSub(`CURRENT_MODE_${mMeeting.localParticipant.id}`);

  const participantRef = useRef();
  const publishRef = useRef();

  useEffect(() => {
    publishRef.current = publish;
  }, [publish]);

  useEffect(() => {
    mMeetingRef.current = mMeeting;
  }, [mMeeting]);

  useEffect(() => {
    participantRef.current = participant;
  }, [participant]);

  usePubSub(`CHANGE_MODE_${mMeeting?.localParticipant?.id}`, {
    onMessageReceived: (data) => {
      if (data.message.mode === meetingModes.CONFERENCE) {
        setReqModeInfo({
          enabled: true,
          mode: data.message.mode,
          accept: () => {},
          reject: () => {},
        });
      } else {
        setMeetingMode(data.message.mode);
        publishRef.current(data.message.mode, { persist: true });

        const muteMic = mMeetingRef.current?.muteMic;
        const disableWebcam = mMeetingRef.current?.disableWebcam;
        const disableScreenShare = mMeetingRef.current?.disableScreenShare;

        muteMic();
        disableWebcam();
        disableScreenShare();

        (participantRef.current?.pinState?.share ||
          participantRef.current?.pinState?.cam) &&
          participantRef.current?.unpin();

        setSideBarMode(null);
      }
    },
  });

  const { publish: invitatioAcceptedPublish } = usePubSub(
    `INVITATION_ACCEPT_BY_COHOST`,
    {
      onMessageReceived: (data) => {
        console.log("data", data);
        setCohostActiveState({ accept: true, reject: false, data: data });
      },
      onOldMessagesReceived: (messages) => {
        setCohostActiveState({ accept: false, reject: false, data: null });
      },
    }
  );

  const { publish: invitatioRejectedPublish } = usePubSub(
    `INVITATION_REJECT_BY_COHOST`,
    {
      onMessageReceived: (data) => {
        setCohostActiveState({ accept: false, reject: true, data: data });
      },
      onOldMessagesReceived: (messages) => {
        setCohostActiveState({ accept: false, reject: false, data: null });
      },
    }
  );

  useEffect(() => {
    if (cohostActiveState && cohostActiveState.accept) {
      if (notificationSoundEnabled) {
        new Audio(
          `https://static.videosdk.live/prebuilt/notification.mp3`
        ).play();
      }
      if (notificationAlertsEnabled) {
        enqueueSnackbar(
          `${cohostActiveState.data.senderName} has been added as a Co-host`
        );
      }
    }

    if (cohostActiveState && cohostActiveState.reject) {
      if (notificationSoundEnabled) {
        new Audio(
          `https://static.videosdk.live/prebuilt/notification.mp3`
        ).play();
      }
      if (
        notificationAlertsEnabled &&
        hostId === mMeeting.localParticipant.id
      ) {
        enqueueSnackbar(
          `${cohostActiveState.data.senderName} has rejected the request to become Co-host`
        );
      }
    }
  }, [cohostActiveState]);

  useEffect(() => {
    setTimeout(() => {
      publishRef.current(meetingMode, { persist: true });
    }, 2000);
  }, []);

  return (
    <>
      <ConfirmBox
        open={reqModeInfo.enabled}
        successText={"Accept"}
        rejectText={"Deny"}
        onReject={() => {
          setReqModeInfo(reqInfoDefaultState);
          invitatioRejectedPublish({}, { persist: true });
        }}
        onSuccess={() => {
          setMeetingMode(reqModeInfo.mode);
          publishRef.current(reqModeInfo.mode, { persist: true });
          setReqModeInfo(reqInfoDefaultState);
          invitatioAcceptedPublish({}, { persist: true });
        }}
        title={`Request to become a Co-host`}
        subTitle={`Host has requested you to become a Co-host`}
      />
    </>
  );
};

export default ModeListner;
