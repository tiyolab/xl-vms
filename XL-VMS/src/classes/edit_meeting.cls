public with sharing class edit_meeting {
	@AuraEnabled
    public static List<Contact> searchContact(String searchValue){
       	List<List<sObject>> result =  [find :searchValue+'*' in all fields returning Contact(id, FirstName, LastName, Email)];
        if(result.size() > 0){
            return (List<Contact>)result[0];
        }
        
        return null;
    }
    
    @AuraEnabled
    public static List<Room__c> searchRoom(){
        return [select Id, Name from Room__c where Status__c = 'Free'];
    }
    
    @AuraEnabled
    public static List<Meeting__c> getMeeting(String eventId){
        return [select Id,
               Event_Id__c,
               Subject__c,
               Description__c,
               Host__c,
               Start_Meeting__c,
               End_Meeting__c,
               Guest__c,
               Guest__r.FirstName,
               Guest__r.LastName,
               Guest__r.Email,
               Room__c 
               from Meeting__c where Event_Id__c = :eventId];
    }
    
    @AuraEnabled
    public static Map<String, object> saveChanges(String eventId, 
                                      String subject, 
                                      String description, 
                                      DateTime startMeeting,
                                      DateTime endMeeting, 
                                      Contact[] attendees, 
                                      String room, 
                                      Meeting__c[] oldMeeting){
        System.debug(oldMeeting);
        List<Contact> newContact = new List<Contact>();
        List<Contact> savedContact = new List<Contact>();
        List<Meeting__c> deleteMeeting = new List<Meeting__c>();
        List<Meeting__c> newMeeting = new List<Meeting__c>();
        
        Savepoint sp = Database.setSavepoint();
        
        /**
         * filter between saved contact and todo saved contact (new contact as guest)
         */
        for(Contact c : attendees){
            String tmpId = String.valueOf(c.Id);
            if(tmpId == null || tmpId == ''){
                c.LastName = 'Guest';
                c.ID_Type__c = 'Government ID';
                newContact.add(c);
            }else{
                savedContact.add(c);
            }
        }   

        /**
         * save new contact
         */
        try{
        	insert newContact;    
        }catch(DMLException e){
            Database.rollback(sp);
            return null;
        }
        
        /**
         * merge saved contact and new contact
         */
        savedContact.addAll(newContact);
        
		/**
		 * find which contact is new guest of meeting
		 */
        for(Contact c : savedContact){
            Boolean isNew = true;
            for(Meeting__c oldM : oldMeeting){
                if(c.Id == oldM.Guest__r.Id){
                    isNew = false;
                    break;
                }
            }
            
            if(isNew){
                newMeeting.add(
                new Meeting__c(
                        Host__c = oldMeeting[0].Host__c, 
                        Guest__c = c.Id,
                        Subject__c = subject, 
                        Description__c = description, 
                        Start_Meeting__c = startMeeting,
                        End_Meeting__c = endMeeting, 
                        Room__c = room,
                		Event_Id__c = eventId));
            }   
        }                      
                                   
		/**
		 * find which guest is deleted from meeting
		 */

		for(Meeting__c m : oldMeeting){
            Boolean isDeleted = true;
            for(Contact c : savedContact){
                if(c.Id == m.Guest__r.Id){
                    isDeleted = false;
                    break;
                }
            }
            
            if(isDeleted){
                deleteMeeting.add(m);
            }else{
                m.Subject__c = subject;
                m.Description__c = description;
                m.Start_Meeting__c = startMeeting;
                m.End_Meeting__c = endMeeting;
                m.Room__c = room;
                
                newMeeting.add(m);
            }
        }
        
		System.debug('d = '+deleteMeeting);
		System.debug('n = '+newMeeting);
                                          
        try{
            delete deleteMeeting;
        	upsert newMeeting;
        }catch(DMLException e){
            System.debug(e.getMessage());
            Database.rollback(sp);
            return null;
        }
        
        /**
         * get host timezone
         */
        User u = [select TimeZoneSidKey from User where Id =:UserInfo.getUserId()];
        
        Map<String, object> toReturn = new Map<String, object>();
        toReturn.put('timezone', u.TimeZoneSidKey);
        toReturn.put('meetings', newMeeting);
                                          
		return toReturn;
    }
    
    @AuraEnabled
    public static Boolean test(){
        return true;
    }
}